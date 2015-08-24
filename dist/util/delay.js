"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = delay;

var _rx = require("rx");

function delay(ms) {
  return _rx.Observable.create(function (observer) {
    var timeout = setTimeout(function () {
      observer.onNext();
      observer.onCompleted();
    }, ms);

    return function () {
      return clearTimeout(timeout);
    };
  });
}

module.exports = exports["default"];