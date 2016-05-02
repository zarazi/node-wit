'use strict';

// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Wit = require('../').Wit;

var token = function () {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/weather.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
}();

var firstEntityValue = function firstEntityValue(entities, entity) {
  var val = entities && entities[entity] && Array.isArray(entities[entity]) && entities[entity].length > 0 && entities[entity][0].value;
  if (!val) {
    return null;
  }
  return (typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object' ? val.value : val;
};

var actions = _defineProperty({
  say: function say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge: function merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    var loc = firstEntityValue(entities, 'location');
    if (loc) {
      context.loc = loc;
    }
    cb(context);
  },
  error: function error(sessionId, context, _error) {
    console.log(_error.message);
  }
}, 'fetch-weather', function fetchWeather(sessionId, context, cb) {
  // Here should go the api call, e.g.:
  // context.forecast = apiCall(context.loc)
  context.forecast = 'sunny';
  cb(context);
});

var client = new Wit(token, actions);
client.interactive();