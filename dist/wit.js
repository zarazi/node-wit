'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

require('es6-promise').polyfill();

var fetch = require('node-fetch');
var readline = require('readline');
var uuid = require('node-uuid');
var Logger = require('./logger').Logger;
var logLevels = require('./logger').logLevels;

var DEFAULT_MAX_STEPS = 5;
var CALLBACK_TIMEOUT_MS = 10000;

var l = new Logger(logLevels.LOG);

var makeWitResponseHandler = function makeWitResponseHandler(endpoint, l, cb) {
  var error = function error(err) {
    l.error('[' + endpoint + '] Error: ' + err);
    if (cb) {
      cb(err);
    }
  };

  return function (rsp) {
    if (rsp instanceof Error) {
      return error(rsp);
    }

    var json = rsp[0];
    var status = rsp[1];

    if (json instanceof Error) {
      return error(json);
    }

    var err = json.error || status !== 200 && json.body + ' (' + status + ')';

    if (err) {
      return error(err);
    }

    l.debug('[' + endpoint + '] Response: ' + JSON.stringify(json));
    if (cb) {
      cb(null, json);
    }
  };
};

var validateActions = function validateActions(actions) {
  var learnMore = 'Learn more at https://wit.ai/docs/quickstart';
  if ((typeof actions === 'undefined' ? 'undefined' : _typeof(actions)) !== 'object') {
    throw new Error('The second parameter should be an Object.');
  }
  if (!actions.say) {
    throw new Error('The \'say\' action is missing. ' + learnMore);
  }
  if (!actions.merge) {
    throw new Error('The \'merge\' action is missing. ' + learnMore);
  }
  if (!actions.error) {
    throw new Error('The \'error\' action is missing. ' + learnMore);
  }
  Object.keys(actions).forEach(function (key) {
    if (typeof actions[key] !== 'function') {
      throw new Error('The \'' + key + '\' action should be a function.');
    }
    if (key === 'say' && actions.say.length !== 4) {
      throw new Error('The \'say\' action should accept 4 arguments: sessionId, context, message, callback. ' + learnMore);
    } else if (key === 'merge' && actions.merge.length !== 5) {
      throw new Error('The \'merge\' action should accept 5 arguments: sessionId, context, entities, message, callback. ' + learnMore);
    } else if (key === 'error' && actions.error.length !== 3) {
      throw new Error('The \'error\' action should accept 3 arguments: sessionId, context, error. ' + learnMore);
    } else if (key !== 'say' && key !== 'merge' && key !== 'error' && actions[key].length !== 3) {
      throw new Error('The \'' + key + '\' action should accept 3 arguments: sessionId, context, callback. ' + learnMore);
    }
  });
  return actions;
};

var makeCallbackTimeout = function makeCallbackTimeout(ms) {
  return setTimeout(function () {
    l.warn('I didn\'t get the callback after ' + ms / 1000 + ' seconds. Did you forget to call me back?');
  }, ms);
};

var cbIfActionMissing = function cbIfActionMissing(actions, action, cb) {
  if (!actions.hasOwnProperty(action)) {
    if (cb) {
      cb('No \'' + action + '\' action found.');
    }
    return true;
  }
  return false;
};

var clone = function clone(obj) {
  if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(clone);
    } else {
      var _ret = function () {
        var newObj = {};
        Object.keys(obj).forEach(function (k) {
          newObj[k] = clone(obj[k]);
        });
        return {
          v: newObj
        };
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }
  } else {
    return obj;
  }
};

var Wit = function Wit(token, actions, logger) {
  var _this = this;

  var baseURL = process.env.WIT_URL || 'https://api.wit.ai';
  var headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (logger) {
    l = logger;
  }
  this.actions = validateActions(actions);

  this.message = function (message, context, cb) {
    if (typeof context === 'function') {
      cb = context;
      context = undefined;
    }
    var qs = 'q=' + encodeURIComponent(message);
    if (context) {
      qs += '&context=' + encodeURIComponent(JSON.stringify(context));
    }
    var handler = makeWitResponseHandler('message', l, cb);
    fetch(baseURL + '/message?' + qs, {
      method: 'GET',
      headers: headers
    }).then(function (response) {
      return Promise.all([response.json(), response.status]);
    }).then(handler).catch(handler);
  };

  this.converse = function (sessionId, message, context, cb) {
    var handler = makeWitResponseHandler('converse', l, cb);
    var qs = 'session_id=' + sessionId;
    if (message) {
      qs += '&q=' + encodeURIComponent(message);
    }
    fetch(baseURL + '/converse?' + qs, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(context)
    }).then(function (response) {
      return Promise.all([response.json(), response.status]);
    }).then(handler).catch(handler);
  };

  var makeCallback = function makeCallback(i, sessionId, message, context, cb) {
    var timeoutID = void 0;

    var makeActionCallback = function makeActionCallback() {
      timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
      return function (newContext) {
        if (timeoutID) {
          clearTimeout(timeoutID);
          timeoutID = null;
        }
        var context = newContext || {};
        l.debug('Context\': ' + JSON.stringify(context));

        if (i <= 0) {
          l.warn('Max steps reached, halting.');
          if (cb) {
            cb(null, context);
          }
          return;
        }

        // Retrieving action sequence
        _this.converse(sessionId, null, context, makeCallback(--i, sessionId, message, context, cb).bind(_this));
      };
    };

    var makeSayCallback = function makeSayCallback() {
      timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
      return function () {
        if (arguments.length > 0) {
          throw new Error('The \'say\' callback should not have any arguments!');
        }
        if (timeoutID) {
          clearTimeout(timeoutID);
          timeoutID = null;
        }
        if (i <= 0) {
          l.warn('Max steps reached, halting.');
          if (cb) {
            cb(null, context);
          }
          return;
        }

        // Retrieving action sequence
        this.converse(sessionId, null, context, makeCallback(--i, sessionId, message, context, cb).bind(this));
      };
    };

    return function (error, json) {
      l.debug('Context: ' + JSON.stringify(context));
      error = error || !json.type && 'Couldn\'t find type in Wit response';
      if (error) {
        if (cb) {
          cb(error);
        }
        return;
      }

      var clonedContext = clone(context);
      if (json.type === 'stop') {
        // End of turn
        if (cb) {
          cb(null, context);
        }
        return;
      } else if (json.type === 'msg') {
        if (cbIfActionMissing(_this.actions, 'say', cb)) {
          return;
        }
        l.log('Executing say with message: ' + json.msg);
        _this.actions.say(sessionId, clonedContext, json.msg, makeSayCallback().bind(_this));
      } else if (json.type === 'merge') {
        if (cbIfActionMissing(_this.actions, 'merge', cb)) {
          return;
        }
        l.log('Executing merge action');
        _this.actions.merge(sessionId, clonedContext, json.entities, message, makeActionCallback());
      } else if (json.type === 'action') {
        var action = json.action;
        if (cbIfActionMissing(_this.actions, action, cb)) {
          return;
        }
        l.log('Executing action: ' + action);
        _this.actions[action](sessionId, clonedContext, makeActionCallback());
      } else {
        // error
        if (cbIfActionMissing(_this.actions, 'error', cb)) {
          return;
        }
        l.log('Executing error action');
        _this.actions.error(sessionId, clonedContext, new Error('Oops, I don\'t know what to do.'));
        return;
      }
    };
  };

  this.runActions = function (sessionId, message, context, cb, maxSteps) {
    var steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    _this.converse(sessionId, message, context, makeCallback(steps, sessionId, message, context, cb).bind(_this));
  };

  this.interactive = function (initContext, maxSteps) {
    var sessionId = uuid.v1();
    _this.context = (typeof initContext === 'undefined' ? 'undefined' : _typeof(initContext)) === 'object' ? initContext : {};
    var steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    _this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    _this.rl.setPrompt('> ');
    _this.rl.prompt();
    _this.rl.write(null, { ctrl: true, name: 'e' });
    _this.rl.on('line', function (line) {
      var msg = line.trim();
      _this.runActions(sessionId, msg, _this.context, function (error, context) {
        if (error) {
          l.error(error);
        } else {
          _this.context = context;
        }
        _this.rl.prompt();
        _this.rl.write(null, { ctrl: true, name: 'e' });
      }, steps);
    }.bind(_this));
  };
};

module.exports = {
  Wit: Wit
};