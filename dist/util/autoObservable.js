"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = autoObservable;

var _rx = require("rx");

function autoObservable() {
  var bodyFn = arguments.length <= 0 || arguments[0] === undefined ? noop : arguments[0];

  return _rx.Observable.create(function (observer) {
    bodyFn();
    observer.onNext();
    observer.onCompleted();
  });
}

module.exports = exports["default"];