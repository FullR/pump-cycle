import {Observable, Observer, Subject, BehaviorSubject} from "rx";
import {red, green} from "chalk";
import isTrue from "./util/isTrue";
import delay from "./util/delay";
import isStream from "./util/isStream";
import pumpCycle from "./pump-cycle";


function fakeProcessObserver(time, onCompleteObserver, value=true) {
  setTimeout(() => onCompleteObserver.onNext(value), time);
}

export default function testSystem({
  times={
    valve1CloseTime: 10,
    valve2CloseTime: 10,
    valveOpenTime: 10,
    primeTime: 10,
    pumpTime: 10
  }, 
  timeouts={},
  initialValues={}, 
  debug=false, 
  lowPressure=false
}={}) {
  const inputs = {
    valve1Closed: new BehaviorSubject(!!initialValues.valve1Closed),
    valve2Closed: new BehaviorSubject(!!initialValues.valve2Closed),
    valveOpened: new BehaviorSubject(!!initialValues.valveOpened),
    primeComplete: new BehaviorSubject(!!initialValues.primeComplete),
    lowPressure: new BehaviorSubject(!!initialValues.lowPressure),
    tankIsFull: new BehaviorSubject(!!initialValues.tankIsFull),
    emergencyStop: new BehaviorSubject(!!initialValues.emergencyStop)
  };

  const outputs = {
    closeValves: Observer.create((on) => {
      if(on) {
        fakeProcessObserver(times.valve1CloseTime, inputs.valve1Closed);
        fakeProcessObserver(times.valve2CloseTime, inputs.valve2Closed);
      }
    }),
    openValve: Observer.create((on) => {
      if(on) {
        fakeProcessObserver(times.valveOpenTime, inputs.valveOpened);
      }
    }),
    runPrime: Observer.create((on) => {
      if(on) {
        fakeProcessObserver(times.primeTime, inputs.primeComplete);
      }
    }),
    runPump: Observer.create((on) => {
      if(on) {
        fakeProcessObserver(times.pumpTime, lowPressure ? inputs.lowPressure : inputs.tankIsFull);
      }
    })
  };

  const log = debug ? (str) => console.log(green(str)) : () => {};
  const logError = (error) => debug ? console.log(red(`${error}`)) : null;

  return pumpCycle({inputs, outputs, timeouts});
}
