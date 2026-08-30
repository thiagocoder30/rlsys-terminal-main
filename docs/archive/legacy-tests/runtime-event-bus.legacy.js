import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeEventBus } from "../dist/application/runtime/RuntimeEventBus.js";

function event(id = "evt-1") {
  return {
    id,
    type: "COMMAND_HANDLED",
    occurredAtEpochMs: 1000,
    payload: {
      command: "START",
    },
  };
}

test("publishes event to subscribed listeners", async () => {
  const bus = new RuntimeEventBus();
  const received = [];

  bus.subscribe({
    name: "telemetry",
    handle: async (runtimeEvent) => {
      received.push(runtimeEvent.type);
    },
  });

  const result = await bus.publish(event());

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(received, ["COMMAND_HANDLED"]);
});

test("isolates failing listener and continues delivery", async () => {
  const bus = new RuntimeEventBus();
  const received = [];

  bus.subscribe({
    name: "faulty-reporter",
    handle: async () => {
      throw new Error("disk unavailable");
    },
  });

  bus.subscribe({
    name: "telemetry",
    handle: async (runtimeEvent) => {
      received.push(runtimeEvent.id);
    },
  });

  const result = await bus.publish(event());

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures[0].listenerName, "faulty-reporter");
  assert.match(result.failures[0].message, /disk unavailable/);
  assert.deepEqual(received, ["evt-1"]);
});

test("does not deliver duplicated event id twice", async () => {
  const bus = new RuntimeEventBus();
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  await bus.publish(event("evt-dup"));
  const replay = await bus.publish(event("evt-dup"));

  assert.equal(calls, 1);
  assert.equal(replay.delivered, 0);
  assert.equal(replay.failed, 0);
});

test("supports unsubscribe", async () => {
  const bus = new RuntimeEventBus();
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  assert.equal(bus.listenerCount(), 1);
  assert.equal(bus.unsubscribe("audit"), true);
  assert.equal(bus.listenerCount(), 0);

  await bus.publish(event());

  assert.equal(calls, 0);
});

test("rejects empty listener name", () => {
  const bus = new RuntimeEventBus();

  assert.throws(
    () => bus.subscribe({
      name: "   ",
      handle: async () => undefined,
    }),
    /listener name/,
  );
});

test("rejects invalid event id", async () => {
  const bus = new RuntimeEventBus();

  await assert.rejects(
    () => bus.publish({
      ...event(),
      id: "   ",
    }),
    /event id/,
  );
});

test("rejects invalid timestamp", async () => {
  const bus = new RuntimeEventBus();

  await assert.rejects(
    () => bus.publish({
      ...event(),
      occurredAtEpochMs: Number.NaN,
    }),
    /occurredAtEpochMs/,
  );
});

test("keeps bounded idempotency memory", async () => {
  const bus = new RuntimeEventBus({ maxProcessedEventIds: 2 });
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  await bus.publish(event("evt-1"));
  await bus.publish(event("evt-2"));
  await bus.publish(event("evt-3"));

  const replayOldEvicted = await bus.publish(event("evt-1"));
  const replayRecent = await bus.publish(event("evt-3"));

  assert.equal(replayOldEvicted.delivered, 1);
  assert.equal(replayRecent.delivered, 0);
  assert.equal(calls, 4);
});
