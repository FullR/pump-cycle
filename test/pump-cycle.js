import testSystem from "../lib/test-system";
const noop = () => {};

describe("pump-cycle", () => {
  it("should succeed if timeouts are greater than time required by external system, pressure is high, and emergency stop isn't true", (done) => {
    testSystem().subscribe(noop, (error) => done(error), () => {
      done()
    });
  });

  it("should fail if emergency stop is true", (done) => {
    testSystem({
      initialValues: {emergencyStop: true}
    })
    .subscribe(noop, 
      (error) => {
        if(error._isEmergencyStopError) {
          done()
        } else {
          done("Incorrect error thrown: " + error);
        }
      }, 
      () => {
        done(new Error("Cycle completed despite emergency stop being true"));
      }
    );
  });

  it("should fail if valves take longer than valve timeout to close", (done) => {
    testSystem({
      timeouts: {
        closeValvesTimeout: 100
      },
      times: {
        valve1CloseTime: 150
      }
    })
    .subscribe(noop, () => done(), () => {
      done(new Error("Cycle completed despite valves taking too long to close"));
    });
  });

  it("should fail if priming takes longer than priming timeout", (done) => {
    testSystem({
      timeouts: {
        primeTimeout: 100
      },
      times: {
        primeTime: 150
      }
    })
    .subscribe(noop, (error) => done(), () => {
      done(new Error("Cycle completed despite priming taking too long to complete"));
    });
  });

  it("should fail if pump takes longer than pump timeout to fill the tank", (done) => {
    testSystem({
      timeouts: {
        pumpTimeout: 100
      },
      times: {
        pumpTime: 150
      }
    })
    .subscribe(noop, () => done(), () => {
      done(new Error("Cycle completed despite pumps taking longer than pump timeout to fill tank"));
    });
  });

  it("should fail if low pressure signal is received", (done) => {
    testSystem({
      initialValues: {
        lowPressure: true
      }
    })
    .subscribe(noop, () => done(), () => {
      done(new Error("Cycle completed despite pressure being too low"));
    });
  });
});
