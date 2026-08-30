import test from "node:test";
import assert from "node:assert/strict";

import { RuntimeEventBus } from "../dist/application/runtime/RuntimeEventBus.js";


test("RuntimeEventBus dispatches runtime signals to subscribed handlers", () => {

  const bus = new RuntimeEventBus();

  const received = [];

  const handler = (signal) => {
    received.push({
      id: signal.id,
      targetSector: signal.targetSector,
      confidence: signal.confidence,
      strategyId: signal.strategyId
    });
  };


  bus.subscribe(handler);

  assert.equal(
    bus.getActiveSubscribersCount(),
    1
  );


  bus.dispatchSignal(
    "signal-001",
    7,
    0.91,
    "TRIPLICATION"
  );


  assert.equal(received.length, 1);

  assert.deepEqual(
    received[0],
    {
      id: "signal-001",
      targetSector: 7,
      confidence: 0.91,
      strategyId: "TRIPLICATION"
    }
  );

});


test("RuntimeEventBus removes subscribed handlers", () => {

  const bus = new RuntimeEventBus();

  const handler = () => undefined;


  bus.subscribe(handler);

  assert.equal(
    bus.getActiveSubscribersCount(),
    1
  );


  bus.unsubscribe(handler);


  assert.equal(
    bus.getActiveSubscribersCount(),
    0
  );

});


test("RuntimeEventBus ignores dispatch after no subscribers", () => {

  const bus = new RuntimeEventBus();

  assert.doesNotThrow(() => {

    bus.dispatchSignal(
      "signal-empty",
      1,
      0.5,
      "TEST"
    );

  });

});
