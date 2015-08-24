import {Observable} from "rx";

export default function autoObservable(bodyFn=noop) {
  return Observable.create((observer) => {
    bodyFn();
    observer.onNext();
    observer.onCompleted();
  });
}
