import Rx from "rx";
import {noop, defaults} from "lodash";
import isTrue from "./util/isTrue";
import autoObservable from "./util/autoObservable";
import maybeTimeout from "./util/maybeTimeout";
import delay from "./util/delay";

const {Observable, Observer, BehaviorSubject} = Rx;
const {combineLatest, fromArray, concat} = Observable;
const blankObserver = Observer.create(noop, noop, noop);

export default function runCycle({
  inputs = {
    valve1Closed,
    valve2Closed,
    valveOpened,
    lowPressure,
    primeComplete,
    tankIsFull,
    emergencyStop
  },
  outputs = {},
  timeouts = {},
  log = noop
}={}) {
  const valvesClosed = Observable.combineLatest([inputs.valve1Closed, inputs.valve2Closed], (a, b) => a && b);

  timeouts = defaults({}, timeouts, {
    closeValvesTimeout: 0,
    primeTimeout: 0,
    pumpTimeout: 0,
    pressureMonitorDelay: 0,
    postPumpValveDelay: 0,
    primeDelay: 0
  });

  outputs = defaults({}, outputs, {
    closeValves: blankObserver,
    openValve: blankObserver,
    runPrime: blankObserver,
    runPump: blankObserver
  });

  return Observable.create((cycleObserver) => {
    function closeValves() {
      return Observable.create((observer) => {
        log("Closing valves...");
        const sub = valvesClosed.filter(isTrue).take(1).subscribe(() => {
          log("Valves closed");
          observer.onNext();
          observer.onCompleted();
        });
        outputs.closeValves.onNext(true);

        return () => {
          outputs.closeValves.onNext(false);
          sub.dispose();
        };
      });
    }

    function startPrimePump() {
      return autoObservable(() => {
        log("Starting prime pump");
        outputs.runPrime.onNext(true);
      });
    }

    function waitForPrime() {
      log("Waiting for prime signal...");
      return inputs.primeComplete.filter(isTrue).take(1).do(() => {
        log("Prime signal received");
      });
    }

    function openValve() {
      return Observable.create((observer) => {
        log("Opening valve");
        outputs.openValve.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function startPump() {
      return Observable.create((observer) => {
        log("Starting pump");
        outputs.runPump.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function monitorTankAndPressure() {
      return Observable.create((observer) => {
        log("Waiting for tank full and monitoring pressure");
        const lowPressureObs = inputs.lowPressure.filter(isTrue).take(1).map(() => {throw new Error("low pressure");})
          .do(() => log("Low pressure signal received"));
        const tankFullObs = inputs.tankIsFull.filter(isTrue).take(1);

        const sub = tankFullObs.merge(lowPressureObs).subscribe(() => {
          log("Finished pumping (tank is full)");
          observer.onNext();
          observer.onCompleted();
        }, (error) => {
          observer.onError(error);
        });

        return () => {
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

    const sub =  maybeTimeout(closeValves(), timeouts.closeValvesTimeout, "Close valves timeout reached")
      .do(() => log(`Waiting ${timeouts.primeDelay}ms to begin prime...`))
      .flatMap(() => delay(timeouts.primeDelay))
      .flatMap(startPrimePump)
      .flatMap(() => maybeTimeout(waitForPrime(), timeouts.primeTimeout, "Priming timeout reached"))
      .flatMap(openValve)
      .flatMap(() => {
        return startPump().do(() => log(`Waiting ${timeouts.pressureMonitorDelay}ms to monitor pressure...`))
      })
      .flatMap(() => delay(timeouts.pressureMonitorDelay))
      .flatMap(() => {
        return maybeTimeout(monitorTankAndPressure(), timeouts.pumpTimeout, "Pumping timeout reached")
          .do(() => log(`Waiting ${timeouts.postPumpValveDelay}ms to close valves...`));
      })
      .flatMap(() => delay(timeouts.postPumpValveDelay))
      .flatMap(closeValves)
      .finally(cleanUp)
      .subscribe(noop, (error) => cycleObserver.onError(error), () => {
        cycleObserver.onCompleted();
      });

    const emergencyStopSub = inputs.emergencyStop.filter(isTrue).take(1).subscribe(() => {
      const error = new Error("Emergency stop signal received");
      error._isEmergencyStopError = true; // for testing only
      cycleObserver.onError(error);
    });

    return () => {
      log("Stopping pump cycle");
      sub.dispose();
      emergencyStopSub.dispose();
    };
  });
}
