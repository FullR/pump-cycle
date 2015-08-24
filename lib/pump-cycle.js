import Rx from "rx";
import {noop} from "lodash";
const {Observable, BehaviorSubject} = Rx;
const {combineLatest, fromArray, concat} = Observable;

const log = (...args) => () => console.log(...args);
const isTrue = (v) => !!v;

function outputSubject(initValue=false) {
  return new BehaviorSubject(initValue);
}

function inputSubject(initValue=false) {
  return outputSubject();
}

function autoObservable(bodyFn=noop) {
  return Observable.create((observer) => {
    bodyFn();
    observer.onNext();
    observer.onCompleted();
  });
}

function maybeTimeout(observable, ms, errorText) {
  return ms ? observable.timeout(ms, errorText) : observable;
}

function runCycle({
  valve1Closed,
  valve2Closed,
  valveOpened,
  lowPressure,
  primeComplete,
  tankIsFull,
  stopped
}, {
  closeValvesTimeout=3200,
  primeTimeout=0,
  pumpTimeout=0,
  pressureMonitorDelay=30000,
  postPumpValveDelay=60000,
  primeDelay=5000
}={}) {
  const valvesClosed = combineLatest([valve1Closed, valve2Closed], (a, b) => a && b);

  return Observable.create((observer) => {
    const outputs = {
      closeValves: outputSubject(true),
      openValve: outputSubject(),
      runPrime: outputSubject(),
      runPump: outputSubject()
    };
    observer.onNext(outputs);

    function closeValves() {
      return Observable.create((observer) => {
        console.log("Closing valves...");
        outputs.closeValves.onNext(true);
        const sub = valvesClosed.filter(isTrue).take(1).subscribe(() => {
          console.log("Valves closed");
          observer.onNext();
          observer.onCompleted();
        });

        return () => {
          outputs.closeValves.onNext(false);
          sub.dispose();
        };
      });
    }

    function startPrimePump() {
      return autoObservable(() => {
        console.log("Starting prime pump");
        outputs.runPrime.onNext(true);
      });
    }

    function waitForPrime() {
      console.log("Waiting for prime signal...");
      return primeComplete.filter(isTrue).take(1).map((v) => {
        console.log("Prime signal received");
        return v;
      });
    }

    function openValve() {
      return Observable.create((observer) => {
        console.log("Opening valve");
        outputs.openValve.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function startPump() {
      return Observable.create((observer) => {
        console.log("Starting pump");
        outputs.runPump.onNext(true);
        observer.onNext();
        observer.onCompleted();
      });
    }

    function monitorTankAndPressure() {
      return Observable.create((observer) => {
        console.log("Waiting for tank full and monitoring pressure");
        const lowPressureObs = lowPressure.filter(isTrue).take(1).map(() => {throw new Error("low pressure");});
        const tankFullObs = tankIsFull.filter(isTrue).take(1);//.merge(lowPressureObs);
        const sub = tankFullObs.merge(lowPressureObs).subscribe(() => {
          console.log("Finished pumping (tank is full)");
          observer.onNext();
          observer.onCompleted();
        }, (error) => {
          observer.onError(error);
        });

        return () => {
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

    const sub =  maybeTimeout(closeValves(), closeValvesTimeout, "Close valves timeout reached").do(log(`Waiting ${primeDelay}ms to begin prime...`))
      .flatMap(() => delay(primeDelay))
      .flatMap(startPrimePump)
      .flatMap(() => maybeTimeout(waitForPrime(), primeTimeout, "Priming timeout reached"))
      .flatMap(openValve)
      .flatMap(() => maybeTimeout(startPump(), pumpTimeout, "Pumping timeout reached").do(log(`Waiting ${pressureMonitorDelay}ms to monitor pressure...`)))
      .flatMap(() => delay(pressureMonitorDelay))
      .flatMap(() => monitorTankAndPressure().do(log(`Waiting ${postPumpValveDelay}ms to close valves...`)))
      .flatMap(() => delay(postPumpValveDelay))
      .flatMap(closeValves)
      .finally(cleanUp)
      .subscribe(noop, (error) => observer.onError(error), () => observer.onCompleted());

    return () => {
      console.log("Cancelling pump cycle");
      sub.dispose();
    };
  });
}

function delay(ms) {
  return Observable.create((observer) => {
    const timeout = setTimeout(() => {
      observer.onNext();
      observer.onCompleted();
    }, ms);

    return () => clearTimeout(timeout);
  });
}

const inputs = {
  valve1Closed: inputSubject(),
  valve2Closed: inputSubject(),
  valveOpened: inputSubject(),
  primeComplete: inputSubject(),
  lowPressure: inputSubject(),
  tankIsFull: inputSubject(),
  stopped: inputSubject()
};

function fakeProcess(name, ms, observer, observedValue=true) {
  console.log(name);
  return delay(ms).map(() => {
    observer.onNext(observedValue);
  });
}

const cycle = runCycle(inputs).subscribe((outputs) => {
  const {closeValves, openValve, runPrime, runPump} = outputs;
  const shouldFail = false;

  closeValves.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      inputs.valve1Closed.onNext(true);
      inputs.valve2Closed.onNext(true);
    }, 3000);
  });

  openValve.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      inputs.valveOpened.onNext(true);
    }, 3000);
  });

  runPrime.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      inputs.primeComplete.onNext(true);
    }, 3000);
  });

  runPump.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      if(shouldFail) {
        inputs.lowPressure.onNext(true);
      } else {
        inputs.tankIsFull.onNext(true);
      }
    }, 5000);
  });
}, (error) => {
  console.log("Pumping failed:", error);
}, () => {
  console.log("done");
});

// setTimeout(() => cycle.dispose(), 10000);
