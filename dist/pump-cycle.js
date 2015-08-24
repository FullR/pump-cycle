"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = runCycle;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _rx = require("rx");

var _rx2 = _interopRequireDefault(_rx);

var _lodash = require("lodash");

var _utilIsTrue = require("./util/isTrue");

var _utilIsTrue2 = _interopRequireDefault(_utilIsTrue);

var _utilAutoObservable = require("./util/autoObservable");

var _utilAutoObservable2 = _interopRequireDefault(_utilAutoObservable);

var _utilMaybeTimeout = require("./util/maybeTimeout");

var _utilMaybeTimeout2 = _interopRequireDefault(_utilMaybeTimeout);

var _utilDelay = require("./util/delay");

var _utilDelay2 = _interopRequireDefault(_utilDelay);

var Observable = _rx2["default"].Observable;
var BehaviorSubject = _rx2["default"].BehaviorSubject;
var combineLatest = Observable.combineLatest;
var fromArray = Observable.fromArray;
var concat = Observable.concat;

function runCycle(_ref, _x, logStream) {
  var valve1Closed = _ref.valve1Closed;
  var valve2Closed = _ref.valve2Closed;
  var valveOpened = _ref.valveOpened;
  var lowPressure = _ref.lowPressure;
  var primeComplete = _ref.primeComplete;
  var tankIsFull = _ref.tankIsFull;
  var emergencyStop = _ref.emergencyStop;

  var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var _ref2$closeValvesTimeout = _ref2.closeValvesTimeout;
  var closeValvesTimeout = _ref2$closeValvesTimeout === undefined ? 0 : _ref2$closeValvesTimeout;
  var _ref2$primeTimeout = _ref2.primeTimeout;
  var primeTimeout = _ref2$primeTimeout === undefined ? 0 : _ref2$primeTimeout;
  var _ref2$pumpTimeout = _ref2.pumpTimeout;
  var pumpTimeout = _ref2$pumpTimeout === undefined ? 0 : _ref2$pumpTimeout;
  var _ref2$pressureMonitorDelay = _ref2.pressureMonitorDelay;
  var pressureMonitorDelay = _ref2$pressureMonitorDelay === undefined ? 0 : _ref2$pressureMonitorDelay;
  var _ref2$postPumpValveDelay = _ref2.postPumpValveDelay;
  var postPumpValveDelay = _ref2$postPumpValveDelay === undefined ? 0 : _ref2$postPumpValveDelay;
  var _ref2$primeDelay = _ref2.primeDelay;
  var primeDelay = _ref2$primeDelay === undefined ? 0 : _ref2$primeDelay;

  var valvesClosed = Observable.combineLatest([valve1Closed, valve2Closed], function (a, b) {
    return a && b;
  });
  var log = logStream ? function (str) {
    return logStream.onNext(str);
  } : _lodash.noop;

  return Observable.create(function (cycleObserver) {
    var outputs = {
      closeValves: new BehaviorSubject(true),
      openValve: new BehaviorSubject(false),
      runPrime: new BehaviorSubject(false),
      runPump: new BehaviorSubject(false)
    };
    cycleObserver.onNext(outputs);

    function closeValves() {
      return Observable.create(function (observer) {
        log("Closing valves...");
        outputs.closeValves.onNext(true);
        var sub = valvesClosed.filter(_utilIsTrue2["default"]).take(1).subscribe(function () {
          log("Valves closed");
          observer.onNext();
          observer.onCompleted();
        });

        return function () {
          outputs.closeValves.onNext(false);
          sub.dispose();
        };
      });
    }

    function startPrimePump() {
      return (0, _utilAutoObservable2["default"])(function () {
        log("Starting prime pump");
        outputs.runPrime.onNext(true);
      });
    }

    function waitForPrime() {
      log("Waiting for prime signal...");
      return primeComplete.filter(_utilIsTrue2["default"]).take(1).map(function (v) {
        log("Prime signal received");
        return v;
      });
    }

    function openValve() {
      return Observable.create(function (observer) {
        log("Opening valve");
        outputs.openValve.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function startPump() {
      return Observable.create(function (observer) {
        log("Starting pump");
        outputs.runPump.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function monitorTankAndPressure() {
      return Observable.create(function (observer) {
        log("Waiting for tank full and monitoring pressure");
        var lowPressureObs = lowPressure.filter(_utilIsTrue2["default"]).take(1).map(function () {
          throw new Error("low pressure");
        });
        var tankFullObs = tankIsFull.filter(_utilIsTrue2["default"]).take(1);
        var sub = tankFullObs.merge(lowPressureObs).subscribe(function () {
          log("Finished pumping (tank is full)");
          observer.onNext();
          observer.onCompleted();
        }, function (error) {
          observer.onError(error);
        });

        return function () {
          log("Stopping pump and prime pump");
          outputs.runPump.onNext(false);
          outputs.runPrime.onNext(false);
          sub.dispose();
        };
      });
    }

    function cleanUp() {
      log("Shutting off outputs");
      outputs.runPrime.onNext(false);
      outputs.runPump.onNext(false);
      outputs.openValve.onNext(false);
      outputs.closeValves.onNext(false);
    }

    var sub = (0, _utilMaybeTimeout2["default"])(closeValves(), closeValvesTimeout, "Close valves timeout reached")["do"](function () {
      return log("Waiting " + primeDelay + "ms to begin prime...");
    }).flatMap(function () {
      return (0, _utilDelay2["default"])(primeDelay);
    }).flatMap(startPrimePump).flatMap(function () {
      return (0, _utilMaybeTimeout2["default"])(waitForPrime(), primeTimeout, "Priming timeout reached");
    }).flatMap(openValve).flatMap(function () {
      return startPump()["do"](function () {
        return log("Waiting " + pressureMonitorDelay + "ms to monitor pressure...");
      });
    }).flatMap(function () {
      return (0, _utilDelay2["default"])(pressureMonitorDelay);
    }).flatMap(function () {
      return (0, _utilMaybeTimeout2["default"])(monitorTankAndPressure(), pumpTimeout, "Pumping timeout reached")["do"](function () {
        return log("Waiting " + postPumpValveDelay + "ms to close valves...");
      });
    }).flatMap(function () {
      return (0, _utilDelay2["default"])(postPumpValveDelay);
    }).flatMap(closeValves)["finally"](cleanUp).subscribe(_lodash.noop, function (error) {
      return cycleObserver.onError(error);
    }, function () {
      cycleObserver.onCompleted();
    });

    var emergencyStopSub = emergencyStop.filter(_utilIsTrue2["default"]).take(1).subscribe(function () {
      var error = new Error("Emergency stop received");
      error._isEmergencyStopError = true; // for testing only
      cycleObserver.onError(error);
    });

    return function () {
      log("Stopping pump cycle");
      sub.dispose();
      emergencyStopSub.dispose();
    };
  });
}

module.exports = exports["default"];