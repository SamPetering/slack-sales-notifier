/**
 * Returns errors as values for asynchronous functions.
 * @param {Function} fn - The asynchronous function to execute.
 * @returns {Promise<[any, string|null]>} The result of the function or an error message.
 */
export async function errorValues(fn) {
  try {
    const res = await fn();
    return [res, null];
  } catch (e) {
    const error = 'message' in e ? e.message : e;
    return [null, error];
  }
}

/**
 * Asserts that a value is not falsy.
 * @param {any} value - The value to check.
 * @param {string} name - The name of the variable (for error messages).
 * @throws {Error} Throws an error if the value is falsy.
 */
export function invariant(value, name) {
  if (!value) {
    throw new Error(`${name} is required and cannot be falsy.`);
  }
  return value;
}

/**
 * Handles an array of promises and alerts errors for any that are rejected.
 * @param {...Promise} promises - The promises to be settled.
 * @returns {Promise<Array<any>>} A promise that resolves to an array of values from the fulfilled promises.
 * @throws {Error} If any promise is rejected.
 */
export async function allSettled(...promises) {
  const res = await Promise.allSettled(promises);
  const errors = res.filter((r) => r.status === 'rejected');
  errors.forEach((result) => {
    alertError(result.reason, true);
  });
  return res.map((r) => r.value);
}

/**
 * Alerts an error message to the console, and optionally throws an error.
 * @param {string} err - The error message to be alerted.
 * @param {boolean} [shouldThrow=false] - Whether to throw the error.
 * @throws {Error} If `shouldThrow` is true.
 */
export function alertError(err, shouldThrow = false) {
  console.error(err);
  if (shouldThrow) throw new Error(err);
}
