var retries   = require('./retries')
  , cloneDeep = require('lodash.clonedeep');


/**
 * Add to the request prototype.
 */

module.exports = function (superagent) {
  var Request = superagent.Request;
  Request.prototype.retry = retry;
  return superagent;
};


/**
 * Export retries for extending
 */

module.exports.retries = retries;


/**
 * Sets the amount of times to retry the request
 * @param  {Number} count
 * @param  {Number} interval between retries
 */

function retry (retries, retryInterval) {

  var self    = this
    , oldEnd  = this.end;

  retries = retries || 1;
  retryInterval = retryInterval || 0;

  this.end = function (fn) {
    var timeout = this._timeout;

    function attemptRetry () {
      var selfClone = cloneDeep(self);
      return oldEnd.call(selfClone, function (err, res) {
        self.emit('response', {status: 'RETRY(' + err.code + ')' }); //emits response event that works with superagent - logger in a single aditional middleware scenario; do not copy
        
        if (!retries || !shouldRetry(err, res)) return fn && fn(err, res);

        reset(selfClone, timeout);

        retries--;
        
        setTimeout(function() {
           return attemptRetry();
         }, retryInterval);
      });
    }

    return attemptRetry();
  };

  return this;
}


/**
 * HACK: Resets the internal state of a request.
 */

function reset (request, timeout) {
  request.called = false;
  request.timeout(timeout);
  delete request._timer;

  if (request.req) {
    var headers = request.req._headers;
    var path = request.req.path;

    request.req.abort();
    delete request.req;

    for (var k in headers) {
      request.set(k, headers[k]);
    }

    if (!request.qs) {
      request.req.path = path;
    }
  }
}


/**
 * Determine whether we should retry based upon common error conditions
 * @param  {Error}    err
 * @param  {Response} res
 * @return {Boolean}
 */

function shouldRetry (err, res) {
  return retries.some(function (check) { return check(err, res); });
}
