export default function maybeTimeout(observable, ms, errorText) {
  return ms ? observable.timeout(ms, errorText) : observable;
}
