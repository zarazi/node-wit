'use strict';

var LEVELS = {
  DEBUG: 0,
  LOG: 1,
  WARN: 2,
  ERROR: 3
};

var log = function log(message, label) {
  console.log(label ? '[' + label + '] ' + message : message);
};

var Logger = function Logger(lvl) {
  var _this = this;

  this.level = lvl === undefined ? LEVELS.LOG : lvl;

  this.debug = function (message) {
    if (LEVELS.DEBUG >= _this.level) {
      log(message, 'debug');
    }
  };

  this.log = function (message) {
    if (LEVELS.LOG >= _this.level) {
      log(message);
    }
  };

  this.warn = function (message) {
    if (LEVELS.WARN >= _this.level) {
      log(message, 'warn');
    }
  };

  this.error = function (message) {
    if (LEVELS.ERROR >= _this.level) {
      log(message, 'error');
    }
  };
};

module.exports = {
  Logger: Logger,
  logLevels: LEVELS
};