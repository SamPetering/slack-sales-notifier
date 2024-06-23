import SlackAPI from './api.mjs';
import { invariant, alertError, allSettled } from './utils.mjs';

const ENVIRONMENT = process.env.NODE_ENV || 'development';
const IS_DEV = ENVIRONMENT === 'development';
const CLOSED_WON_CHANNEL_NAME = 'closed-won';
const PROCESSED_MESSAGES_CHANNEL_NAME = 'bot-processed';
const SLACK_TOKEN = invariant(process.env.SLACK_TOKEN, 'SLACK_TOKEN');
const Slack = new SlackAPI(SLACK_TOKEN);

async function getChannelIdByName(searchString, alert = true) {
  const [channels, err] = await Slack.listChannels();
  if (err) {
    alert && alertError(err);
    return null;
  }
  return (
    channels.find(
      (c) =>
        'name' in c &&
        typeof c.name === 'string' &&
        c.name.includes(searchString)
    )?.id ?? null
  );
}

async function getOrCreateChannelId(channelName) {
  if (!channelName) {
    alertError('No channel name provided', true);
  }

  const found = await getChannelIdByName(channelName, false);
  if (found) return found;

  console.info(`couldn't find channel ${channelName}... creating`);

  const [newChannel, err] = await Slack.createChannel(channelName);
  if (err) alertError(err, true);
  console.info(`Successfully created channel ${channelName}`);
  return newChannel.id;
}

async function getClosedWonChannelId() {
  const closedWonChannelId = await getChannelIdByName(CLOSED_WON_CHANNEL_NAME);

  return invariant(closedWonChannelId, 'closedWonChannelId');
}

async function getProcessedMessagesChannelId() {
  const processedMessagesChannelId = await getOrCreateChannelId(
    PROCESSED_MESSAGES_CHANNEL_NAME
  );

  return invariant(processedMessagesChannelId, 'processedMessagesChannelId');
}

function extractClosedWonData(inputStr) {
  const pattern = /(.+?) just closed (.+?) for (.+)/;
  const match = inputStr.match(pattern);
  if (match) {
    const group1 = match[1];
    const group2 = match[2];
    const group3 = match[3];
    return {
      closer: group1.trim(),
      customer: group2.trim(),
      amount: group3.replaceAll(/[$,!]/g, ''),
    };
  } else {
    return null;
  }
}

async function channelHasMessage(channelId, messageText) {
  const [messages, err] = await Slack.getChannelMessages(channelId, 100);
  if (err) alertError(err, true);
  return messages.some((m) => m.text.includes(messageText));
}

async function notifyESP32() {
  // TODO: implement
  return Promise.resolve(true);
}

export async function handler(event) {
  if (IS_DEV) console.info('received event', event);
  // get (or create) channel ids
  const [closedWonChannelId, processedMessagesChannelId] = await allSettled(
    getClosedWonChannelId(),
    getProcessedMessagesChannelId()
  );
  // get messages from closed-won
  const [messagesResp, err] =
    await Slack.getChannelMessages(closedWonChannelId);
  if (err) alertError(err, true);

  // filter, map, and parse the results
  const devFilter = (m) => 'client_msg_id' in m;
  const prodFilter = (m) => {
    return (
      'ts' in m &&
      'text' in m &&
      m.type === 'message' &&
      m.subtype === 'bot_message' &&
      m.username === 'HubSpot'
    );
  };
  const filterMessages = IS_DEV ? devFilter : prodFilter;
  const messages = messagesResp.filter(filterMessages).map((m) => ({
    id: m.text,
    text: m.text,
    ts: m.ts,
  }));
  const parsed = extractClosedWonData(messages[0].text);
  if (!parsed) {
    console.info('No closed won message found... exiting');
    return;
  }

  // check if found closed-won message has already been processed
  const { closer, customer, amount } = parsed;
  const processedMessageId = [closer, customer, amount]
    .join(':')
    .replaceAll(' ', '');
  const alreadyProcessed = await channelHasMessage(
    processedMessagesChannelId,
    processedMessageId
  );
  if (alreadyProcessed) {
    console.info(`Already processed ${processedMessageId}... exiting`);
    return;
  }

  const notified = await notifyESP32();
  if (notified) {
    const [success, err] = await Slack.sendMessageToChannel(
      PROCESSED_MESSAGES_CHANNEL_NAME,
      processedMessageId
    );
    if (!success) {
      alertError(err);
      // TODO: retry writing to channel?
    }
  } else {
    // TODO: retry logic?
    console.info(
      `Something went wrong while notifiying for ${processedMessageId}... exiting`
    );
    return;
  }
}

if (IS_DEV) {
  // run handler in dev
  await handler();
}
