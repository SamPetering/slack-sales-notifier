import { errorValues } from './utils.mjs';

class SlackAPI {
  _TOKEN;

  constructor(token) {
    if (!token) throw new Error('Missing Slack token');
    this._TOKEN = token;
  }

  getToken() {
    return this._TOKEN;
  }

  /**
   * Lists all channels in the Slack workspace.
   * @returns {Promise<[Array<{name: string, id: string}>, string|null]>} An array of channels or an error message.
   */
  async listChannels() {
    return errorValues(async () => {
      const response = await fetch('https://slack.com/api/conversations.list', {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Error listing channels: ${data.error}`);
      }

      return data.channels.map((channel) => ({
        name: channel.name,
        id: channel.id,
      }));
    });
  }

  /**
   * Creates a new channel in the Slack workspace.
   * @param {string} channelName - The name of the channel to create.
   * @returns {Promise<[Object, string|null]>} The created channel object or an error message.
   */
  async createChannel(channelName) {
    return errorValues(async () => {
      const params = new URLSearchParams();
      params.append('token', this.getToken());
      params.append('name', channelName);

      const response = await fetch(
        'https://slack.com/api/conversations.create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        }
      );

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Error creating channel: ${data.error}`);
      }

      return data.channel;
    });
  }

  /**
   * Retrieves messages from a specified channel.
   * @param {string} channelId - The ID of the channel to retrieve messages from.
   * @returns {Promise<[Array<{text: string, ts: string}>, string|null]>} An array of messages or an error message.
   */
  async getChannelMessages(channelId, limit = 10) {
    return errorValues(async () => {
      const response = await fetch(
        `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Error retrieving messages: ${data.error}`);
      }
      return data.messages;
    });
  }

  /**
   * Sends a message to a Slack channel.
   * @param {string} channel - Channel name where the message will be sent.
   * @param {string} message - The text message to be sent.
   * @returns {Promise<boolean>} Indicates if the message was successfully sent.
   */
  async sendMessageToChannel(channel, message) {
    return errorValues(async () => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getToken()}`,
        },
        body: JSON.stringify({
          channel,
          text: message,
        }),
      });

      const data = await response.json();

      return data.ok; // Return true if message was successfully sent, otherwise false
    });
  }
}

export default SlackAPI;
