import Rx from "rx";
import {noop} from "lodash";
import isTrue from "./util/isTrue";
import autoObservable from "./util/autoObservable";
import maybeTimeout from "./util/maybeTimeout";
import delay from "./util/delay";

const {Observable, BehaviorSubject} = Rx;
const {combineLatest, fromArray, concat} = Observable;

export default function runCycle({
  valve1Closed,
  valve2Closed,
  valveOpened,
  lowPressure,
  primeComplete,
  tankIsFull,
  emergencyStop
}, {
  closeValvesTimeout=0,
  primeTimeout=0,
  pumpTimeout=0,
  pressureMonitorDelay=0,
  postPumpValveDelay=0,
  primeDelay=0
}={}, logStream) {
  const valvesClosed = Observable.combineLatest([valve1Closed, valve2Closed], (a, b) => a && b);
  const log = logStream ? (str) => logStream.onNext(str) : noop;

  return Observable.create((cycleObserver) => {
    const outputs = {
      closeValves: new BehaviorSubject(true),
      openValve: new BehaviorSubject(false),
      runPrime: new BehaviorSubject(false),
      runPump: new BehaviorSubject(false)
    };
    cycleObserver.onNext(outputs);

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
      return primeComplete.filter(isTrue).take(1).map((v) => {
        log("Prime signal received");
        return v;
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
        const lowPressureObs = lowPressure.filter(isTrue).take(1).map(() => {throw new Error("low pressure");});
        const tankFullObs = tankIsFull.filter(isTrue).take(1);
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

    const sub =  maybeTimeout(closeValves(), closeValvesTimeout, "Close valves timeout reached")
      .do(() => log(`Waiting ${primeDelay}ms to begin prime...`))
      .flatMap(() => delay(primeDelay))
      .flatMap(startPrimePump)
      .flatMap(() => maybeTimeout(waitForPrime(), primeTimeout, "Priming timeout reached"))
      .flatMap(openValve)
      .flatMap(() => {
        return startPump().do(() => log(`Waiting ${pressureMonitorDelay}ms to monitor pressure...`))
      })
      .flatMap(() => delay(pressureMonitorDelay))
      .flatMap(() => {
        return maybeTimeout(monitorTankAndPressure(), pumpTimeout, "Pumping timeout reached")
          .do(() => log(`Waiting ${postPumpValveDelay}ms to close valves...`));
      })
      .flatMap(() => delay(postPumpValveDelay))
      .flatMap(closeValves)
      .finally(cleanUp)
      .subscribe(noop, (error) => cycleObserver.onError(error), () => {
        cycleObserver.onCompleted();
      });

    const emergencyStopSub = emergencyStop.filter(isTrue).take(1).subscribe(() => {
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
