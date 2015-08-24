"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = maybeTimeout;

function maybeTimeout(observable, ms, errorText) {
  return ms ? observable.timeout(ms, errorText) : observable;
}

module.exports = exports["default"];