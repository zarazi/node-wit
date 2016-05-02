'use strict';

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;

var Wit = require('../').Wit;

var token = function () {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/template.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
}();

var actions = {
  say: function say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge: function merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error: function error(sessionId, context, err) {
    console.log(err.message);
  }
};

var client = new Wit(token, actions);
client.interactive();