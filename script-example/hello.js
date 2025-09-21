/**
 * @typedef {import("./http_client")}
 */

/**
 * @param {Options} options
 */
const run = async (options) => {
  const { param, message, utils } = options;
  const { Http, Body } = utils;
  if (!param) {
    throw 'INVALID_PARAMETERS';
  }
  return `Hello ${param}!`;
};
