"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _rx = require("rx");

var _rx2 = _interopRequireDefault(_rx);

var _lodash = require("lodash");

var Observable = _rx2["default"].Observable;
var BehaviorSubject = _rx2["default"].BehaviorSubject;
var combineLatest = Observable.combineLatest;
var fromArray = Observable.fromArray;
var concat = Observable.concat;

var log = function log() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return function () {
    return console.log.apply(console, args);
  };
};
var isTrue = function isTrue(v) {
  return !!v;
};

function outputSubject() {
  var initValue = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

  return new BehaviorSubject(initValue);
}

function inputSubject() {
  var initValue = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

  return outputSubject();
}

function autoObservable() {
  var bodyFn = arguments.length <= 0 || arguments[0] === undefined ? _lodash.noop : arguments[0];

  return Observable.create(function (observer) {
    bodyFn();
    observer.onNext();
    observer.onCompleted();
  });
}

function maybeTimeout(observable, ms, errorText) {
  return ms ? observable.timeout(ms, errorText) : observable;
}

function runCycle(_ref) {
  var valve1Closed = _ref.valve1Closed;
  var valve2Closed = _ref.valve2Closed;
  var valveOpened = _ref.valveOpened;
  var lowPressure = _ref.lowPressure;
  var primeComplete = _ref.primeComplete;
  var tankIsFull = _ref.tankIsFull;
  var stopped = _ref.stopped;

  var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var _ref2$closeValvesTimeout = _ref2.closeValvesTimeout;
  var closeValvesTimeout = _ref2$closeValvesTimeout === undefined ? 3200 : _ref2$closeValvesTimeout;
  var _ref2$primeTimeout = _ref2.primeTimeout;
  var primeTimeout = _ref2$primeTimeout === undefined ? 0 : _ref2$primeTimeout;
  var _ref2$pumpTimeout = _ref2.pumpTimeout;
  var pumpTimeout = _ref2$pumpTimeout === undefined ? 0 : _ref2$pumpTimeout;
  var _ref2$pressureMonitorDelay = _ref2.pressureMonitorDelay;
  var pressureMonitorDelay = _ref2$pressureMonitorDelay === undefined ? 30000 : _ref2$pressureMonitorDelay;
  var _ref2$postPumpValveDelay = _ref2.postPumpValveDelay;
  var postPumpValveDelay = _ref2$postPumpValveDelay === undefined ? 60000 : _ref2$postPumpValveDelay;
  var _ref2$primeDelay = _ref2.primeDelay;
  var primeDelay = _ref2$primeDelay === undefined ? 5000 : _ref2$primeDelay;

  var valvesClosed = combineLatest([valve1Closed, valve2Closed], function (a, b) {
    return a && b;
  });

  return Observable.create(function (observer) {
    var outputs = {
      closeValves: outputSubject(true),
      openValve: outputSubject(),
      runPrime: outputSubject(),
      runPump: outputSubject()
    };
    observer.onNext(outputs);

    function closeValves() {
      return Observable.create(function (observer) {
        console.log("Closing valves...");
        outputs.closeValves.onNext(true);
        var sub = valvesClosed.filter(isTrue).take(1).subscribe(function () {
          console.log("Valves closed");
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
      return autoObservable(function () {
        console.log("Starting prime pump");
        outputs.runPrime.onNext(true);
      });
    }

    function waitForPrime() {
      console.log("Waiting for prime signal...");
      return primeComplete.filter(isTrue).take(1).map(function (v) {
        console.log("Prime signal received");
        return v;
      });
    }

    function openValve() {
      return Observable.create(function (observer) {
        console.log("Opening valve");
        outputs.openValve.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function startPump() {
      return Observable.create(function (observer) {
        console.log("Starting pump");
        outputs.runPump.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function monitorTankAndPressure() {
      return Observable.create(function (observer) {
        console.log("Waiting for tank full and monitoring pressure");
        var lowPressureObs = lowPressure.filter(isTrue).take(1).map(function () {
          throw new Error("low pressure");
        });
        var tankFullObs = tankIsFull.filter(isTrue).take(1); //.merge(lowPressureObs);
        var sub = tankFullObs.merge(lowPressureObs).subscribe(function () {
          console.log("Finished pumping (tank is full)");
          observer.onNext();
          observer.onCompleted();
        }, function (error) {
          observer.onError(error);
        });

        return function () {
          console.log("Stopping pump and prime pump");
          outputs.runPump.onNext(false);
          outputs.runPrime.onNext(false);
          sub.dispose();
        };
      });
    }

    function cleanUp() {
      console.log("Shutting off outputs");
      outputs.runPrime.onNext(false);
      outputs.runPump.onNext(false);
      outputs.openValve.onNext(false);
      outputs.closeValves.onNext(false);
    }

    var sub = maybeTimeout(closeValves(), closeValvesTimeout, "Close valves timeout reached")["do"](log("Waiting " + primeDelay + "ms to begin prime...")).flatMap(function () {
      return delay(primeDelay);
    }).flatMap(startPrimePump).flatMap(function () {
      return maybeTimeout(waitForPrime(), primeTimeout, "Priming timeout reached");
    }).flatMap(openValve).flatMap(function () {
      return maybeTimeout(startPump(), pumpTimeout, "Pumping timeout reached")["do"](log("Waiting " + pressureMonitorDelay + "ms to monitor pressure..."));
    }).flatMap(function () {
      return delay(pressureMonitorDelay);
    }).flatMap(function () {
      return monitorTankAndPressure()["do"](log("Waiting " + postPumpValveDelay + "ms to close valves..."));
    }).flatMap(function () {
      return delay(postPumpValveDelay);
    }).flatMap(closeValves)["finally"](cleanUp).subscribe(_lodash.noop, function (error) {
      return observer.onError(error);
    }, function () {
      return observer.onCompleted();
    });

    return function () {
      console.log("Cancelling pump cycle");
      sub.dispose();
    };
  });
}

function delay(ms) {
  return Observable.create(function (observer) {
    var timeout = setTimeout(function () {
      observer.onNext();
      observer.onCompleted();
    }, ms);

    return function () {
      return clearTimeout(timeout);
    };
  });
}

var inputs = {
  valve1Closed: inputSubject(),
  valve2Closed: inputSubject(),
  valveOpened: inputSubject(),
  primeComplete: inputSubject(),
  lowPressure: inputSubject(),
  tankIsFull: inputSubject(),
  stopped: inputSubject()
};

function fakeProcess(name, ms, observer) {
  var observedValue = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

  console.log(name);
  return delay(ms).map(function () {
    observer.onNext(observedValue);
  });
}

var cycle = runCycle(inputs).subscribe(function (outputs) {
  var closeValves = outputs.closeValves;
  var openValve = outputs.openValve;
  var runPrime = outputs.runPrime;
  var runPump = outputs.runPump;

  var shouldFail = false;

  closeValves.filter(isTrue).subscribe(function () {
    setTimeout(function () {
      inputs.valve1Closed.onNext(true);
      inputs.valve2Closed.onNext(true);
    }, 3000);
  });

  openValve.filter(isTrue).subscribe(function () {
    setTimeout(function () {
      inputs.valveOpened.onNext(true);
    }, 3000);
  });

  runPrime.filter(isTrue).subscribe(function () {
    setTimeout(function () {
      inputs.primeComplete.onNext(true);
    }, 3000);
  });

  runPump.filter(isTrue).subscribe(function () {
    setTimeout(function () {
      if (shouldFail) {
        inputs.lowPressure.onNext(true);
      } else {
        inputs.tankIsFull.onNext(true);
      }
    }, 5000);
  });
}, function (error) {
  console.log("Pumping failed:", error);
}, function () {
  console.log("done");
});

setTimeout(function () {
  return cycle.dispose();
}, 10000);

