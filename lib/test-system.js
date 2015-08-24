import {BehaviorSubject} from "rx";
import isTrue from "./util/isTrue";
import delay from "./util/delay";
import pumpCycle from "./pump-cycle";

function fakeProcess(name, ms, observer, observedValue=true) {
  console.log(name);
  return delay(ms).map(() => {
    observer.onNext(observedValue);
  });
}

function externalSystem(inputs, outputs) {
  const shouldFail = false;

  inputs.closeValves.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.valve1Closed.onNext(true);
      outputs.valve2Closed.onNext(true);
    }, 3000);
  });

  inputs.openValve.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.valveOpened.onNext(true);
    }, 3000);
  });

  inputs.runPrime.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.primeComplete.onNext(true);
    }, 3000);
  });

  inputs.runPump.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      if(shouldFail) {
        outputs.lowPressure.onNext(true);
      } else {
        outputs.tankIsFull.onNext(true);
      }
    }, 5000);
  });
}

function testSystem() {
  const outputs = {
    valve1Closed: new BehaviorSubject(false),
    valve2Closed: new BehaviorSubject(false),
    valveOpened: new BehaviorSubject(false),
    primeComplete: new BehaviorSubject(false),
    lowPressure: new BehaviorSubject(false),
    tankIsFull: new BehaviorSubject(false),
    stopped: new BehaviorSubject(false)
  };

  return pumpCycle(outputs).subscribe(
    (inputs) => externalSystem(inputs, outputs), 
    (error) => console.log("Error", error),
    () => console.log("Done")
  );
}

testSystem();