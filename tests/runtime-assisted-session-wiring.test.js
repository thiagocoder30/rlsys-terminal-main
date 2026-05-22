import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeAssistedSessionWiring } from "../dist/application/session/RuntimeAssistedSessionWiring.js";

class MemoryStateRepository {
  constructor() {
    this.commandIds = new Set();
    this.profile = null;
  }

  async loadProcessedCommandIds() {
    return this.commandIds;
  }

  async saveProcessedCommandIds(commandIds) {
    this.commandIds = new Set(commandIds);
  }

  async saveActiveProfile(profile) {
    this.profile = profile;
  }
}

function createProfile() {
  return {
    profileId: "operator-default",
    bankroll: 1000,
    stopLoss: 100,
    targetProfit: 150,
  };
}

test("boots with loaded profile and dispatches PROFILE_LOADED", async () => {
  const dispatched = [];
  const stateRepository = new MemoryStateRepository();

  const wiring = new RuntimeAssistedSessionWiring({
    riskProfileLoader: { load: async () => createProfile() },
    setupWizard: { run: async () => { throw new Error("setup should not run"); } },
    coordinator: {
      dispatch: async (command) => {
        dispatched.push(command.type);
        return { accepted: true, status: "OK", message: "accepted" };
      },
    },
    ledger: { recordWin: async () => undefined, recordLoss: async () => undefined },
    hudComposer: { compose: async () => "HUD READY" },
    reportComposer: { compose: async () => "REPORT READY" },
    stateRepository,
  });

  const result = await wiring.boot();

  assert.equal(result.accepted, true);
  assert.deepEqual(dispatched, ["PROFILE_LOADED"]);
  assert.equal(stateRepository.profile.profileId, "operator-default");
});

test("runs setup when profile is missing", async () => {
  let setupRuns = 0;

  const wiring = new RuntimeAssistedSessionWiring({
    riskProfileLoader: { load: async () => null },
    setupWizard: {
      run: async () => {
        setupRuns += 1;
        return createProfile();
      },
    },
    coordinator: {
      dispatch: async () => ({ accepted: true, status: "OK", message: "accepted" }),
    },
    ledger: { recordWin: async () => undefined, recordLoss: async () => undefined },
    hudComposer: { compose: async () => "HUD READY" },
    reportComposer: { compose: async () => "REPORT READY" },
    stateRepository: new MemoryStateRepository(),
  });

  await wiring.boot();

  assert.equal(setupRuns, 1);
});

test("records WIN and returns HUD", async () => {
  let winAmount = 0;

  const wiring = new RuntimeAssistedSessionWiring({
    riskProfileLoader: { load: async () => createProfile() },
    setupWizard: { run: async () => createProfile() },
    coordinator: {
      dispatch: async () => ({ accepted: true, status: "WIN_RECORDED", message: "win accepted" }),
    },
    ledger: {
      recordWin: async (amount) => { winAmount = amount; },
      recordLoss: async () => undefined,
    },
    hudComposer: { compose: async () => "BANKROLL HUD" },
    reportComposer: { compose: async () => "REPORT READY" },
    stateRepository: new MemoryStateRepository(),
  });

  await wiring.boot();

  const result = await wiring.handle({
    id: "cmd-win-1",
    type: "WIN",
    amount: 25,
    occurredAtEpochMs: Date.now(),
  });

  assert.equal(winAmount, 25);
  assert.equal(result.status, "WIN_RECORDED");
  assert.equal(result.hud, "BANKROLL HUD");
});

test("makes repeated command idempotent", async () => {
  let lossCalls = 0;

  const wiring = new RuntimeAssistedSessionWiring({
    riskProfileLoader: { load: async () => createProfile() },
    setupWizard: { run: async () => createProfile() },
    coordinator: {
      dispatch: async () => ({ accepted: true, status: "LOSS_RECORDED", message: "loss accepted" }),
    },
    ledger: {
      recordWin: async () => undefined,
      recordLoss: async () => { lossCalls += 1; },
    },
    hudComposer: { compose: async () => "BANKROLL HUD" },
    reportComposer: { compose: async () => "REPORT READY" },
    stateRepository: new MemoryStateRepository(),
  });

  await wiring.boot();

  const command = {
    id: "cmd-loss-1",
    type: "LOSS",
    amount: 10,
    occurredAtEpochMs: Date.now(),
  };

  await wiring.handle(command);
  const replay = await wiring.handle(command);

  assert.equal(lossCalls, 1);
  assert.equal(replay.status, "IDEMPOTENT_REPLAY");
});

test("generates human report on FINISH", async () => {
  const wiring = new RuntimeAssistedSessionWiring({
    riskProfileLoader: { load: async () => createProfile() },
    setupWizard: { run: async () => createProfile() },
    coordinator: {
      dispatch: async () => ({ accepted: true, status: "FINISHED", message: "session closed" }),
    },
    ledger: { recordWin: async () => undefined, recordLoss: async () => undefined },
    hudComposer: { compose: async () => "BANKROLL HUD" },
    reportComposer: { compose: async () => "HUMAN REPORT" },
    stateRepository: new MemoryStateRepository(),
  });

  await wiring.boot();

  const result = await wiring.handle({
    id: "cmd-finish-1",
    type: "FINISH",
    occurredAtEpochMs: Date.now(),
  });

  assert.equal(result.status, "FINISHED");
  assert.equal(result.report, "HUMAN REPORT");
});
