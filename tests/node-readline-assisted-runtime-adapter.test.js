import test from "node:test";
import assert from "node:assert/strict";
import { NodeReadlineAssistedRuntimeAdapter } from "../dist/infrastructure/runtime/NodeReadlineAssistedRuntimeAdapter.js";

class MemoryReader {
  constructor(lines) {
    this.lines = [...lines];
    this.closed = false;
  }

  async question() {
    const next = this.lines.shift();

    if (next === undefined) {
      return "finish";
    }

    return next;
  }

  close() {
    this.closed = true;
  }
}

test("runs terminal loop until runtime requests stop", async () => {
  const reader = new MemoryReader(["start", "finish"]);
  const output = [];
  const handled = [];

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async (input) => {
        handled.push(input);

        return {
          shouldContinue: input !== "finish",
          message: "handled",
        };
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
    },
  );

  await adapter.run();

  assert.deepEqual(handled, ["start", "finish"]);
  assert.equal(reader.closed, true);
  assert.deepEqual(output, ["welcome", "bye"]);
});

test("closes reader even when runtime step fails", async () => {
  const reader = new MemoryReader(["start"]);
  const output = [];

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async () => {
        throw new Error("runtime failure");
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
    },
  );

  await assert.rejects(() => adapter.run(), /runtime failure/);

  assert.equal(reader.closed, true);
  assert.deepEqual(output, ["welcome", "bye"]);
});

test("stops at maxSteps safety limit", async () => {
  const reader = new MemoryReader(["start", "start", "start"]);
  const output = [];
  let calls = 0;

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async () => {
        calls += 1;

        return {
          shouldContinue: true,
          message: "handled",
        };
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
      maxSteps: 2,
    },
  );

  await adapter.run();

  assert.equal(calls, 2);
  assert.equal(output.includes("Runtime stopped because maxSteps safety limit was reached."), true);
  assert.equal(reader.closed, true);
});
