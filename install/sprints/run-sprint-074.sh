#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-074-runtime-recovery-wiring"
COMMIT_MSG="feat(runtime): wire recovery inspection into assisted boot"

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

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 074: Runtime Recovery Wiring =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

# Corrige sujeira recorrente de build em dist/
git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/runtime
mkdir -p tests

cat > src/application/runtime/RuntimeRecoveryBootCoordinator.ts <<'TS'
import type {
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  RuntimeRecoveryResult,
} from "./RuntimeRecoveryService.js";

export interface RuntimeRecoveryInspectorPort {
  inspect(): Promise<RuntimeRecoveryResult>;
}

export interface AssistedRuntimeBootPort {
  boot(): Promise<AssistedSessionResult>;
}

export type RuntimeRecoveryBootStatus =
  | "BOOTED_CLEAN"
  | "BOOTED_RECOVERED"
  | "BOOT_BLOCKED";

export interface RuntimeRecoveryBootResult {
  readonly status: RuntimeRecoveryBootStatus;
  readonly booted: boolean;
  readonly message: string;
  readonly recovery: RuntimeRecoveryResult;
  readonly assistedResult?: AssistedSessionResult;
}

/**
 * Coordinates recovery inspection before assisted runtime boot.
 *
 * This service prevents the runtime from starting over corrupted persisted state.
 *
 * Complexity:
 * - O(k), delegated to recovery inspection.
 * - O(1) orchestration overhead.
 * - Memory bounded by the recovery snapshot size.
 */
export class RuntimeRecoveryBootCoordinator {
  public constructor(
    private readonly recoveryInspector: RuntimeRecoveryInspectorPort,
    private readonly assistedRuntime: AssistedRuntimeBootPort,
  ) {}

  public async boot(): Promise<RuntimeRecoveryBootResult> {
    const recovery = await this.recoveryInspector.inspect();

    if (recovery.status === "CORRUPTED_SNAPSHOT") {
      return {
        status: "BOOT_BLOCKED",
        booted: false,
        message: "Runtime boot blocked because assisted session snapshot is corrupted.",
        recovery,
      };
    }

    const assistedResult = await this.assistedRuntime.boot();

    if (recovery.status === "RECOVERABLE_SESSION") {
      return {
        status: "BOOTED_RECOVERED",
        booted: true,
        message: "Runtime booted with recoverable assisted session state.",
        recovery,
        assistedResult,
      };
    }

    return {
      status: "BOOTED_CLEAN",
      booted: true,
      message: "Runtime booted with a clean assisted session state.",
      recovery,
      assistedResult,
    };
  }
}
TS

cat > tests/runtime-recovery-boot-coordinator.test.js <<'JS'
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
JS

npm run build
npm test

# Evita carregar artefatos dist modificados para a main
git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeRecoveryBootCoordinator.ts \
  tests/runtime-recovery-boot-coordinator.test.js \
  install/sprints/run-sprint-074.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 074 runtime recovery wiring"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 074 completed, merged and pushed successfully =="
