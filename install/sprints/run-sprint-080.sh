#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-080-e2e-assisted-runtime-session"
COMMIT_MSG="feat(runtime): add end-to-end assisted session orchestrator"

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

echo "== Sprint 080: End-to-End Assisted Runtime Session =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/runtime
mkdir -p tests

cat > src/application/runtime/EndToEndAssistedRuntimeSession.ts <<'TS'
import type {
  AssistedSessionCommand,
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  RuntimeRecoveryBootResult,
} from "./RuntimeRecoveryBootCoordinator.js";
import type {
  RuntimeSessionCheckpointResult,
} from "./RuntimeSessionCheckpointEngine.js";

export interface EndToEndRecoveryBootPort {
  boot(): Promise<RuntimeRecoveryBootResult>;
}

export interface EndToEndAssistedHandlerPort {
  handle(command: AssistedSessionCommand): Promise<AssistedSessionResult>;
}

export interface EndToEndCheckpointPort {
  checkpoint(request: {
    readonly commandId?: string;
    readonly reason:
      | "COMMAND_PROCESSED"
      | "TIME_INTERVAL"
      | "MANUAL"
      | "SESSION_FINISH"
      | "RECOVERY_POINT";
    readonly occurredAtEpochMs: number;
    readonly force?: boolean;
  }): Promise<RuntimeSessionCheckpointResult>;
}

export interface EndToEndSessionCommandResult {
  readonly command: AssistedSessionCommand;
  readonly assistedResult: AssistedSessionResult;
  readonly checkpointResult: RuntimeSessionCheckpointResult;
}

export interface EndToEndSessionResult {
  readonly boot: RuntimeRecoveryBootResult;
  readonly commands: readonly EndToEndSessionCommandResult[];
  readonly finished: boolean;
  readonly finalReport?: string;
}

/**
 * Application-level orchestrator that validates a full assisted runtime session.
 *
 * It composes existing services but owns no domain rule:
 * recovery boot, assisted command handling and checkpointing remain isolated.
 *
 * Complexity:
 * - O(n), where n is the command count.
 * - Memory O(n) for the returned execution trace.
 */
export class EndToEndAssistedRuntimeSession {
  public constructor(
    private readonly recoveryBoot: EndToEndRecoveryBootPort,
    private readonly assistedHandler: EndToEndAssistedHandlerPort,
    private readonly checkpointEngine: EndToEndCheckpointPort,
  ) {}

  public async run(
    commands: readonly AssistedSessionCommand[],
  ): Promise<EndToEndSessionResult> {
    const boot = await this.recoveryBoot.boot();

    if (!boot.booted) {
      return {
        boot,
        commands: [],
        finished: false,
      };
    }

    const commandResults: EndToEndSessionCommandResult[] = [];
    let finished = false;
    let finalReport: string | undefined;

    for (const command of commands) {
      const assistedResult = await this.assistedHandler.handle(command);

      const checkpointResult = await this.checkpointEngine.checkpoint({
        commandId: command.id,
        reason: command.type === "FINISH" ? "SESSION_FINISH" : "COMMAND_PROCESSED",
        occurredAtEpochMs: command.occurredAtEpochMs,
        force: command.type === "FINISH",
      });

      commandResults.push({
        command,
        assistedResult,
        checkpointResult,
      });

      if (command.type === "FINISH" || command.type === "RESET") {
        finished = true;
        finalReport = assistedResult.report;
        break;
      }
    }

    return {
      boot,
      commands: commandResults,
      finished,
      finalReport,
    };
  }
}
TS

cat > tests/end-to-end-assisted-runtime-session.test.js <<'JS'
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
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/EndToEndAssistedRuntimeSession.ts \
  tests/end-to-end-assisted-runtime-session.test.js \
  install/sprints/run-sprint-080.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 080 end-to-end assisted runtime session"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 080 completed, merged and pushed successfully =="
