#!/usr/bin/env bash
set -euo pipefail

SPRINT="sprint-071"
BRANCH="sprint-071-runtime-assisted-session-wiring"
COMMIT_MSG="feat(runtime): wire assisted session runtime flow"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] && [ -d "$dir/src" ]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  echo "ERROR: package.json not found at $ROOT_DIR" >&2
  exit 1
fi

echo "== Sprint 071: Runtime Assisted Session Wiring =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/session
mkdir -p tests

cat > src/application/session/RuntimeAssistedSessionWiring.ts <<'TS'
export type AssistedSessionCommandType =
  | "PROFILE_LOADED"
  | "START"
  | "WIN"
  | "LOSS"
  | "PAUSE"
  | "RESUME"
  | "REPORT"
  | "FINISH"
  | "RESET";

export interface AssistedSessionCommand {
  readonly id: string;
  readonly type: AssistedSessionCommandType;
  readonly amount?: number;
  readonly occurredAtEpochMs: number;
}

export interface AssistedSessionResult {
  readonly accepted: boolean;
  readonly status: string;
  readonly message: string;
  readonly hud?: string;
  readonly report?: string;
}

export interface OperatorRiskProfileSnapshot {
  readonly profileId: string;
  readonly bankroll: number;
  readonly stopLoss: number;
  readonly targetProfit: number;
}

export interface RiskProfileLoaderPort {
  load(): Promise<OperatorRiskProfileSnapshot | null>;
}

export interface OperatorSetupWizardPort {
  run(): Promise<OperatorRiskProfileSnapshot>;
}

export interface GuidedModeCoordinatorPort {
  dispatch(command: AssistedSessionCommand): Promise<AssistedSessionResult>;
}

export interface PaperLedgerRuntimePort {
  recordWin(amount: number): Promise<void>;
  recordLoss(amount: number): Promise<void>;
}

export interface BankrollHudComposerPort {
  compose(profile: OperatorRiskProfileSnapshot): Promise<string>;
}

export interface HumanSessionReportComposerPort {
  compose(): Promise<string>;
}

export interface AssistedSessionStateRepositoryPort {
  loadProcessedCommandIds(): Promise<ReadonlySet<string>>;
  saveProcessedCommandIds(commandIds: ReadonlySet<string>): Promise<void>;
  saveActiveProfile(profile: OperatorRiskProfileSnapshot): Promise<void>;
}

/**
 * Application service that wires the assisted runtime session flow.
 *
 * It does not own business rules. It only orchestrates existing ports:
 * profile loading, guided coordinator, paper ledger, HUD and human report.
 *
 * Complexity:
 * - boot: O(k), where k is the number of persisted idempotency keys.
 * - handle: O(1) in the common path.
 * - memory: bounded by maxIdempotencyKeys.
 */
export class RuntimeAssistedSessionWiring {
  private readonly maxIdempotencyKeys: number;
  private processedCommandIds: Set<string> = new Set<string>();
  private activeProfile: OperatorRiskProfileSnapshot | null = null;

  public constructor(
    private readonly dependencies: {
      readonly riskProfileLoader: RiskProfileLoaderPort;
      readonly setupWizard: OperatorSetupWizardPort;
      readonly coordinator: GuidedModeCoordinatorPort;
      readonly ledger: PaperLedgerRuntimePort;
      readonly hudComposer: BankrollHudComposerPort;
      readonly reportComposer: HumanSessionReportComposerPort;
      readonly stateRepository: AssistedSessionStateRepositoryPort;
      readonly maxIdempotencyKeys?: number;
    },
  ) {
    this.maxIdempotencyKeys = dependencies.maxIdempotencyKeys ?? 512;
  }

  public async boot(): Promise<AssistedSessionResult> {
    this.processedCommandIds = new Set<string>(
      await this.dependencies.stateRepository.loadProcessedCommandIds(),
    );

    const loadedProfile = await this.dependencies.riskProfileLoader.load();
    const profile = loadedProfile ?? await this.dependencies.setupWizard.run();

    this.activeProfile = profile;
    await this.dependencies.stateRepository.saveActiveProfile(profile);

    return this.dependencies.coordinator.dispatch({
      id: `profile-loaded-${profile.profileId}`,
      type: "PROFILE_LOADED",
      occurredAtEpochMs: Date.now(),
    });
  }

  public async handle(command: AssistedSessionCommand): Promise<AssistedSessionResult> {
    if (this.processedCommandIds.has(command.id)) {
      return {
        accepted: true,
        status: "IDEMPOTENT_REPLAY",
        message: "Command already processed safely.",
      };
    }

    if (this.activeProfile === null && command.type !== "RESET") {
      return {
        accepted: false,
        status: "PROFILE_NOT_LOADED",
        message: "A loaded risk profile is required before operational commands.",
      };
    }

    await this.applyFinancialSideEffect(command);

    const coordinatorResult = await this.dependencies.coordinator.dispatch(command);

    const hud = this.activeProfile === null
      ? undefined
      : await this.dependencies.hudComposer.compose(this.activeProfile);

    const report = command.type === "REPORT" || command.type === "FINISH"
      ? await this.dependencies.reportComposer.compose()
      : undefined;

    await this.markProcessed(command.id);

    if (command.type === "RESET") {
      this.activeProfile = null;
    }

    return {
      accepted: coordinatorResult.accepted,
      status: coordinatorResult.status,
      message: coordinatorResult.message,
      hud,
      report,
    };
  }

  private async applyFinancialSideEffect(command: AssistedSessionCommand): Promise<void> {
    if (command.type !== "WIN" && command.type !== "LOSS") {
      return;
    }

    const amount = command.amount;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid ${command.type} amount. Expected a positive finite number.`);
    }

    if (command.type === "WIN") {
      await this.dependencies.ledger.recordWin(amount);
      return;
    }

    await this.dependencies.ledger.recordLoss(amount);
  }

  private async markProcessed(commandId: string): Promise<void> {
    this.processedCommandIds.add(commandId);

    if (this.processedCommandIds.size > this.maxIdempotencyKeys) {
      const compacted = Array.from(this.processedCommandIds).slice(
        this.processedCommandIds.size - this.maxIdempotencyKeys,
      );
      this.processedCommandIds = new Set<string>(compacted);
    }

    await this.dependencies.stateRepository.saveProcessedCommandIds(this.processedCommandIds);
  }
}
TS

cat > tests/runtime-assisted-session-wiring.test.js <<'JS'
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
JS

npm run build
npm test

git add src/application/session/RuntimeAssistedSessionWiring.ts tests/runtime-assisted-session-wiring.test.js install/sprints/run-sprint-071.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 071 runtime assisted session wiring"
git push origin main

echo "== Sprint 071 completed, merged and pushed successfully =="
