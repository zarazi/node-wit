'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_PAGE_ID=your_page_id FB_PAGE_TOKEN=your_page_token FB_VERIFY_TOKEN=verify_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/fb` as callback URL.
// 6. Talk to your bot on Messenger!

var bodyParser = require('body-parser');
var express = require('express');
var request = require('request');

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
var Wit = require('../').Wit;

// Webserver parameter
var PORT = process.env.PORT || 8445;

// Wit.ai parameters
var WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
var FB_PAGE_ID = process.env.FB_PAGE_ID && Number(process.env.FB_PAGE_ID);
if (!FB_PAGE_ID) {
  throw new Error('missing FB_PAGE_ID');
}
var FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
  throw new Error('missing FB_PAGE_TOKEN');
}
var FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference
var fbReq = request.defaults({
  uri: 'https://graph.facebook.com/me/messages',
  method: 'POST',
  json: true,
  qs: { access_token: FB_PAGE_TOKEN },
  headers: { 'Content-Type': 'application/json' }
});

var fbMessage = function fbMessage(recipientId, msg, cb) {
  var opts = {
    form: {
      recipient: {
        id: recipientId
      },
      message: {
        text: msg
      }
    }
  };
  fbReq(opts, function (err, resp, data) {
    if (cb) {
      cb(err || data.error && data.error.message, data);
    }
  });
};

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
var getFirstMessagingEntry = function getFirstMessagingEntry(body) {
  var val = body.object == 'page' && body.entry && Array.isArray(body.entry) && body.entry.length > 0 && body.entry[0] && body.entry[0].id == FB_PAGE_ID && body.entry[0].messaging && Array.isArray(body.entry[0].messaging) && body.entry[0].messaging.length > 0 && body.entry[0].messaging[0];
  return val || null;
};

// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
var sessions = {};

var findOrCreateSession = function findOrCreateSession(fbid) {
  var sessionId = void 0;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(function (k) {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = { fbid: fbid, context: {} };
  }
  return sessionId;
};

// Our bot actions
var actions = {
  say: function say(sessionId, context, message, cb) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    var recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      fbMessage(recipientId, message, function (err, data) {
        if (err) {
          console.log('Oops! An error occurred while forwarding the response to', recipientId, ':', err);
        }

        // Let's give the wheel back to our bot
        cb();
      });
    } else {
      console.log('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      cb();
    }
  },
  merge: function merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error: function error(sessionId, context, _error) {
    console.log(_error.message);
  }
};

// Setting up our bot

// You should implement your custom actions here
// See https://wit.ai/docs/quickstart
var wit = new Wit(WIT_TOKEN, actions);

// Starting our webserver and putting it all together
var app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// Webhook setup
app.get('/fb', function (req, res) {
  if (!FB_VERIFY_TOKEN) {
    throw new Error('missing FB_VERIFY_TOKEN');
  }
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/fb', function (req, res) {
  // Parsing the Messenger API response
  var messaging = getFirstMessagingEntry(req.body);
  if (messaging && messaging.message && messaging.recipient.id === FB_PAGE_ID) {
    (function () {
      // Yay! We got a new message!

      // We retrieve the Facebook user ID of the sender
      var sender = messaging.sender.id;

      // We retrieve the user's current session, or create one if it doesn't exist
      // This is needed for our bot to figure out the conversation history
      var sessionId = findOrCreateSession(sender);

      // We retrieve the message content
      var msg = messaging.message.text;
      var atts = messaging.message.attachments;

      if (atts) {
        // We received an attachment

        // Let's reply with an automatic message
        fbMessage(sender, 'Sorry I can only process text messages for now.');
      } else if (msg) {
        // We received a text message

        // Let's forward the message to the Wit.ai Bot Engine
        // This will run all actions until our bot has nothing left to do
        wit.runActions(sessionId, // the user's current session
        msg, // the user's message
        sessions[sessionId].context, // the user's current session state
        function (error, context) {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            // Our bot did everything it has to do.
            // Now it's waiting for further messages to proceed.
            console.log('Waiting for futher messages.');

            // Based on the session state, you might want to reset the session.
            // This depends heavily on the business logic of your bot.
            // Example:
            // if (context['done']) {
            //   delete sessions[sessionId];
            // }

            // Updating the user's current session state
            sessions[sessionId].context = context;
          }
        });
      }
    })();
  }
  res.sendStatus(200);
});