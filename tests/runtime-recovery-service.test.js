import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeRecoveryService } from "../dist/application/runtime/RuntimeRecoveryService.js";

function createProfile() {
  return {
    profileId: "operator-default",
    bankroll: 1000,
    stopLoss: 100,
    targetProfit: 150,
  };
}

test("classifies empty repository as clean start", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => null,
    loadProcessedCommandIds: async () => new Set(),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CLEAN_START");
  assert.equal(result.canRecover, false);
  assert.equal(result.processedCommandCount, 0);
});

test("classifies active profile snapshot as recoverable session", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => createProfile(),
    loadProcessedCommandIds: async () => new Set(["cmd-1", "cmd-2"]),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "RECOVERABLE_SESSION");
  assert.equal(result.canRecover, true);
  assert.equal(result.activeProfile.profileId, "operator-default");
  assert.equal(result.processedCommandCount, 2);
});

test("classifies command ids without active profile as corrupted snapshot", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => null,
    loadProcessedCommandIds: async () => new Set(["cmd-1"]),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CORRUPTED_SNAPSHOT");
  assert.equal(result.canRecover, false);
  assert.match(result.message, /Processed commands exist/);
});

test("does not throw when repository read fails", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => {
      throw new Error("invalid json");
    },
    loadProcessedCommandIds: async () => new Set(),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CORRUPTED_SNAPSHOT");
  assert.equal(result.canRecover, false);
  assert.match(result.message, /invalid json/);
});
