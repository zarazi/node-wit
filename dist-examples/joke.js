'use strict';

// Joke example
// See https://wit.ai/patapizza/example-joke

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Wit = require('../').Wit;

var token = function () {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/joke.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
}();

var allJokes = {
  chuck: ['Chuck Norris counted to infinity - twice.', 'Death once had a near-Chuck Norris experience.'],
  tech: ['Did you hear about the two antennas that got married? The ceremony was long and boring, but the reception was great!', 'Why do geeks mistake Halloween and Christmas? Because Oct 31 === Dec 25.'],
  default: ['Why was the Math book sad? Because it had so many problems.']
};

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
    delete context.joke;
    var category = firstEntityValue(entities, 'category');
    if (category) {
      context.cat = category;
    }
    var sentiment = firstEntityValue(entities, 'sentiment');
    if (sentiment) {
      context.ack = sentiment === 'positive' ? 'Glad you liked it.' : 'Hmm.';
    } else {
      delete context.ack;
    }
    cb(context);
  },
  error: function error(sessionId, context, _error) {
    console.log(_error.message);
  }
}, 'select-joke', function selectJoke(sessionId, context, cb) {
  var jokes = allJokes[context.cat || 'default'];
  context.joke = jokes[Math.floor(Math.random() * jokes.length)];
  cb(context);
});

var client = new Wit(token, actions);
client.interactive();