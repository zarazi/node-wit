require('es6-promise').polyfill();

module.exports = {
  Logger: require('./dist/logger.js').Logger,
  logLevels: require('./dist/logger.js').logLevels,
  Wit: require('./dist/wit.js').Wit,
}
