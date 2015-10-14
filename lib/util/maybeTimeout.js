import {Observable} from "rx";

export default function maybeTimeout(observable, ms, errorText) {
  return ms ? observable.timeout(ms, Observable.throw(new Error(errorText))) : observable;
}
