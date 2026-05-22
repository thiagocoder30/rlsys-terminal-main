import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeRecoveryBootCoordinator } from "../dist/application/runtime/RuntimeRecoveryBootCoordinator.js";

function cleanRecovery() {
  return {
    status: "CLEAN_START",
    canRecover: false,
    message: "clean",
    activeProfile: null,
    processedCommandCount: 0,
  };
}

function recoverableRecovery() {
  return {
    status: "RECOVERABLE_SESSION",
    canRecover: true,
    message: "recoverable",
    activeProfile: {
      profileId: "operator-default",
      bankroll: 1000,
      stopLoss: 100,
      targetProfit: 150,
    },
    processedCommandCount: 3,
  };
}

function corruptedRecovery() {
  return {
    status: "CORRUPTED_SNAPSHOT",
    canRecover: false,
    message: "corrupted",
    activeProfile: null,
    processedCommandCount: 0,
  };
}

function assistedBootResult() {
  return {
    accepted: true,
    status: "PROFILE_LOADED",
    message: "profile loaded",
  };
}

test("boots clean runtime when recovery inspector reports clean start", async () => {
  let bootCalls = 0;

  const coordinator = new RuntimeRecoveryBootCoordinator(
    { inspect: async () => cleanRecovery() },
    {
      boot: async () => {
        bootCalls += 1;
        return assistedBootResult();
      },
    },
  );

  const result = await coordinator.boot();

  assert.equal(result.status, "BOOTED_CLEAN");
  assert.equal(result.booted, true);
  assert.equal(bootCalls, 1);
});

test("boots recovered runtime when recoverable session exists", async () => {
  let bootCalls = 0;

  const coordinator = new RuntimeRecoveryBootCoordinator(
    { inspect: async () => recoverableRecovery() },
    {
      boot: async () => {
        bootCalls += 1;
        return assistedBootResult();
      },
    },
  );

  const result = await coordinator.boot();

  assert.equal(result.status, "BOOTED_RECOVERED");
  assert.equal(result.booted, true);
  assert.equal(result.recovery.processedCommandCount, 3);
  assert.equal(bootCalls, 1);
});

test("blocks runtime boot when snapshot is corrupted", async () => {
  let bootCalls = 0;

  const coordinator = new RuntimeRecoveryBootCoordinator(
    { inspect: async () => corruptedRecovery() },
    {
      boot: async () => {
        bootCalls += 1;
        return assistedBootResult();
      },
    },
  );

  const result = await coordinator.boot();

  assert.equal(result.status, "BOOT_BLOCKED");
  assert.equal(result.booted, false);
  assert.equal(bootCalls, 0);
});
