import {Observable, Subject, BehaviorSubject} from "rx";
import {red, green} from "chalk";
import isTrue from "./util/isTrue";
import delay from "./util/delay";
import isStream from "./util/isStream";
import pumpCycle from "./pump-cycle";

function externalSystemSim(inputs, outputs, {
  valve1CloseTime=10,
  valve2CloseTime=10,
  valveOpenTime=10,
  primeTime=10,
  pumpTime=10,
  isPressureLow=false
}={}) {
  inputs.closeValves.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.valve1Closed.onNext(true);
    }, valve1CloseTime);

    setTimeout(() => {
      outputs.valve2Closed.onNext(true);
    }, valve2CloseTime);
  });

  inputs.openValve.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.valveOpened.onNext(true);
    }, valveOpenTime);
  });

  inputs.runPrime.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      outputs.primeComplete.onNext(true);
    }, primeTime);
  });

  inputs.runPump.filter(isTrue).subscribe(() => {
    setTimeout(() => {
      if(isPressureLow) {
        outputs.lowPressure.onNext(true);
      } else {
        outputs.tankIsFull.onNext(true);
      }
    }, pumpTime);
  });
}

export default function testSystem({timeouts={}, times={}, initialValues={}, debug=false}={}) {
  const outputs = {
    valve1Closed: new BehaviorSubject(!!initialValues.valve1Closed),
    valve2Closed: new BehaviorSubject(!!initialValues.valve2Closed),
    valveOpened: new BehaviorSubject(!!initialValues.valveOpened),
    primeComplete: new BehaviorSubject(!!initialValues.primeComplete),
    lowPressure: new BehaviorSubject(!!initialValues.lowPressure),
    tankIsFull: new BehaviorSubject(!!initialValues.tankIsFull),
    emergencyStop: new BehaviorSubject(!!initialValues.emergencyStop)
  };

  const log = (str) => debug ? console.log(green(str)) : null;
  const logError = (error) => debug ? console.log(red(`${error}`)) : null;
  const logStream = new Subject();

  logStream.subscribe(log);

  return Observable.create((observer) => {
    const sub = pumpCycle(outputs, timeouts, logStream)
      .subscribe(
        (inputs) => {
          externalSystemSim(inputs, outputs, times);
        },
        (error) => observer.onError(error),
        () => {
          log("Pump cycle completed");
          observer.onCompleted();
        }
      );
    return () => sub.dispose();
  });
}
