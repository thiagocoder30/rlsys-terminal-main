import test from "node:test";
import assert from "node:assert/strict";
import { EndToEndAssistedRuntimeSession } from "../dist/application/runtime/EndToEndAssistedRuntimeSession.js";

function bootResult() {
  return {
    status: "BOOTED_CLEAN",
    booted: true,
    message: "booted",
    recovery: {
      status: "CLEAN_START",
      canRecover: false,
      message: "clean",
      activeProfile: null,
      processedCommandCount: 0,
    },
    assistedResult: {
      accepted: true,
      status: "PROFILE_LOADED",
      message: "profile loaded",
    },
  };
}

function command(id, type, amount, occurredAtEpochMs) {
  return {
    id,
    type,
    amount,
    occurredAtEpochMs,
  };
}

test("runs complete assisted session until FINISH", async () => {
  const handled = [];
  const checkpoints = [];

  const session = new EndToEndAssistedRuntimeSession(
    { boot: async () => bootResult() },
    {
      handle: async (cmd) => {
        handled.push(cmd.type);

        return {
          accepted: true,
          status: cmd.type,
          message: `${cmd.type} accepted`,
          report: cmd.type === "FINISH" ? "FINAL HUMAN REPORT" : undefined,
        };
      },
    },
    {
      checkpoint: async (request) => {
        checkpoints.push(request);

        return {
          saved: true,
          status: "CHECKPOINT_SAVED",
          message: "checkpoint saved",
          checkpoint: {
            checkpointId: `checkpoint-${request.commandId}`,
            reason: request.reason,
            commandId: request.commandId,
            createdAtEpochMs: request.occurredAtEpochMs,
            sequence: checkpoints.length,
          },
        };
      },
    },
  );

  const result = await session.run([
    command("cmd-start", "START", undefined, 1000),
    command("cmd-win", "WIN", 25, 2000),
    command("cmd-loss", "LOSS", 10, 3000),
    command("cmd-finish", "FINISH", undefined, 4000),
  ]);

  assert.equal(result.boot.booted, true);
  assert.equal(result.finished, true);
  assert.equal(result.commands.length, 4);
  assert.deepEqual(handled, ["START", "WIN", "LOSS", "FINISH"]);
  assert.equal(checkpoints[3].reason, "SESSION_FINISH");
  assert.equal(checkpoints[3].force, true);
  assert.equal(result.finalReport, "FINAL HUMAN REPORT");
});

test("does not process commands when boot is blocked", async () => {
  let handleCalls = 0;

  const session = new EndToEndAssistedRuntimeSession(
    {
      boot: async () => ({
        status: "BOOT_BLOCKED",
        booted: false,
        message: "blocked",
        recovery: {
          status: "CORRUPTED_SNAPSHOT",
          canRecover: false,
          message: "corrupted",
          activeProfile: null,
          processedCommandCount: 0,
        },
      }),
    },
    {
      handle: async () => {
        handleCalls += 1;
        throw new Error("should not handle");
      },
    },
    {
      checkpoint: async () => {
        throw new Error("should not checkpoint");
      },
    },
  );

  const result = await session.run([
    command("cmd-start", "START", undefined, 1000),
  ]);

  assert.equal(result.finished, false);
  assert.equal(result.commands.length, 0);
  assert.equal(handleCalls, 0);
});

test("stops processing after RESET", async () => {
  const handled = [];

  const session = new EndToEndAssistedRuntimeSession(
    { boot: async () => bootResult() },
    {
      handle: async (cmd) => {
        handled.push(cmd.type);

        return {
          accepted: true,
          status: cmd.type,
          message: `${cmd.type} accepted`,
        };
      },
    },
    {
      checkpoint: async (request) => ({
        saved: true,
        status: "CHECKPOINT_SAVED",
        message: "checkpoint saved",
        checkpoint: {
          checkpointId: `checkpoint-${request.commandId}`,
          reason: request.reason,
          commandId: request.commandId,
          createdAtEpochMs: request.occurredAtEpochMs,
          sequence: 1,
        },
      }),
    },
  );

  const result = await session.run([
    command("cmd-start", "START", undefined, 1000),
    command("cmd-reset", "RESET", undefined, 2000),
    command("cmd-win", "WIN", 10, 3000),
  ]);

  assert.equal(result.finished, true);
  assert.equal(result.commands.length, 2);
  assert.deepEqual(handled, ["START", "RESET"]);
});
