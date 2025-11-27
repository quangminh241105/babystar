/**
 * Middleware Index
 * Central export for all middleware modules
 */

const auth = require('./auth');
const rateLimit = require('./rateLimit');

module.exports = {
  ...auth,
  ...rateLimit
};
