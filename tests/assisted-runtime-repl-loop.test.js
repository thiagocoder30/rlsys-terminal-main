import test from "node:test";
import assert from "node:assert/strict";
import { AssistedRuntimeReplLoop } from "../dist/application/runtime/AssistedRuntimeReplLoop.js";

test("prints parser rejection and continues", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "UNKNOWN_COMMAND",
        accepted: false,
        message: "Unknown command.",
      }),
    },
    {
      handle: async () => {
        throw new Error("handler should not run");
      },
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("invalid", 1000);

  assert.equal(result.accepted, false);
  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Unknown command."]);
});

test("handles parsed command and prints message plus HUD", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-start",
          type: "START",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "STARTED",
        message: "Session started.",
        hud: "HUD READY",
      }),
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("start", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Session started.", "HUD READY"]);
});

test("prints report when handler returns report", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-report",
          type: "REPORT",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "REPORT_READY",
        message: "Report generated.",
        report: "HUMAN REPORT",
      }),
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("report", 1000);

  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Report generated.", "HUMAN REPORT"]);
});

test("stops loop after FINISH command", async () => {
  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-finish",
          type: "FINISH",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "FINISHED",
        message: "Session finished.",
      }),
    },
    { writeLine: () => undefined },
  );

  const result = await loop.step("finish", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, false);
});

test("stops loop after RESET command", async () => {
  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-reset",
          type: "RESET",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "RESET",
        message: "Session reset.",
      }),
    },
    { writeLine: () => undefined },
  );

  const result = await loop.step("reset", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, false);
});
