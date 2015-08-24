"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = testSystem;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _rx = require("rx");

var _chalk = require("chalk");

var _utilIsTrue = require("./util/isTrue");

var _utilIsTrue2 = _interopRequireDefault(_utilIsTrue);

var _utilDelay = require("./util/delay");

var _utilDelay2 = _interopRequireDefault(_utilDelay);

var _utilIsStream = require("./util/isStream");

var _utilIsStream2 = _interopRequireDefault(_utilIsStream);

var _pumpCycle = require("./pump-cycle");

var _pumpCycle2 = _interopRequireDefault(_pumpCycle);

function fakeProcess(name, ms, observer) {
  var observedValue = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

  console.log(name);
  return (0, _utilDelay2["default"])(ms).map(function () {
    observer.onNext(observedValue);
  });
}

function externalSystemSim(inputs, outputs) {
  var _ref = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var _ref$valve1CloseTime = _ref.valve1CloseTime;
  var valve1CloseTime = _ref$valve1CloseTime === undefined ? 10 : _ref$valve1CloseTime;
  var _ref$valve2CloseTime = _ref.valve2CloseTime;
  var valve2CloseTime = _ref$valve2CloseTime === undefined ? 10 : _ref$valve2CloseTime;
  var _ref$valveOpenTime = _ref.valveOpenTime;
  var valveOpenTime = _ref$valveOpenTime === undefined ? 10 : _ref$valveOpenTime;
  var _ref$primeTime = _ref.primeTime;
  var primeTime = _ref$primeTime === undefined ? 10 : _ref$primeTime;
  var _ref$pumpTime = _ref.pumpTime;
  var pumpTime = _ref$pumpTime === undefined ? 10 : _ref$pumpTime;
  var _ref$isPressureLow = _ref.isPressureLow;
  var isPressureLow = _ref$isPressureLow === undefined ? false : _ref$isPressureLow;

  inputs.closeValves.filter(_utilIsTrue2["default"]).subscribe(function () {
    setTimeout(function () {
      outputs.valve1Closed.onNext(true);
    }, valve1CloseTime);

    setTimeout(function () {
      outputs.valve2Closed.onNext(true);
    }, valve2CloseTime);
  });

  inputs.openValve.filter(_utilIsTrue2["default"]).subscribe(function () {
    setTimeout(function () {
      outputs.valveOpened.onNext(true);
    }, valveOpenTime);
  });

  inputs.runPrime.filter(_utilIsTrue2["default"]).subscribe(function () {
    setTimeout(function () {
      outputs.primeComplete.onNext(true);
    }, primeTime);
  });

  inputs.runPump.filter(_utilIsTrue2["default"]).subscribe(function () {
    setTimeout(function () {
      if (isPressureLow) {
        outputs.lowPressure.onNext(true);
      } else {
        outputs.tankIsFull.onNext(true);
      }
    }, pumpTime);
  });
}

function testSystem() {
  var _ref2 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var _ref2$timeouts = _ref2.timeouts;
  var timeouts = _ref2$timeouts === undefined ? {} : _ref2$timeouts;
  var _ref2$times = _ref2.times;
  var times = _ref2$times === undefined ? {} : _ref2$times;
  var _ref2$initialValues = _ref2.initialValues;
  var initialValues = _ref2$initialValues === undefined ? {} : _ref2$initialValues;
  var _ref2$debug = _ref2.debug;
  var debug = _ref2$debug === undefined ? false : _ref2$debug;

  var outputs = {
    valve1Closed: new _rx.BehaviorSubject(!!initialValues.valve1Closed),
    valve2Closed: new _rx.BehaviorSubject(!!initialValues.valve2Closed),
    valveOpened: new _rx.BehaviorSubject(!!initialValues.valveOpened),
    primeComplete: new _rx.BehaviorSubject(!!initialValues.primeComplete),
    lowPressure: new _rx.BehaviorSubject(!!initialValues.lowPressure),
    tankIsFull: new _rx.BehaviorSubject(!!initialValues.tankIsFull),
    emergencyStop: new _rx.BehaviorSubject(!!initialValues.emergencyStop)
  };

  var log = function log(str) {
    return debug ? console.log((0, _chalk.green)(str)) : null;
  };
  var logError = function logError(error) {
    return debug ? console.log((0, _chalk.red)("" + error)) : null;
  };
  var logStream = new _rx.Subject();

  logStream.subscribe(log);

  return _rx.Observable.create(function (observer) {
    var sub = (0, _pumpCycle2["default"])(outputs, timeouts, logStream).subscribe(function (inputs) {
      externalSystemSim(inputs, outputs, times);
    }, function (error) {
      return observer.onError(error);
    }, function () {
      log("Pump cycle completed");
      observer.onCompleted();
    });
    return function () {
      return sub.dispose();
    };
  });
}

module.exports = exports["default"];