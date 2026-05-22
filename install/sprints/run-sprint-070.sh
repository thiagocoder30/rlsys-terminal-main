#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="070-runtime-guided-mode-wiring"
BRANCH="sprint-070-runtime-guided-mode-wiring"
PROJECT_DIR="${PROJECT_DIR:-$HOME/rlsys-terminal-main}"
LOG_DIR="/sdcard/Download"
LOG_FILE="$LOG_DIR/rlsys-terminal-$SPRINT.log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'echo "[ERROR] Sprint failed at line $LINENO"; exit 1' ERR

cd "$PROJECT_DIR"

git checkout main
git pull origin main
git reset --hard origin/main
git clean -fd tests 2>/dev/null || true
rm -f install/sprints/run-sprint-test.sh
git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p src/application/session tests install/sprints

cat > src/application/session/RuntimeGuidedModeCoordinator.ts <<'TS'
import {
  GuidedOperationCommand,
  GuidedOperationMode,
  GuidedOperationResult,
  GuidedOperationState,
} from './GuidedOperationMode';

export type RuntimeGuidedInputType =
  | 'PROFILE_LOADED'
  | 'START'
  | 'WIN'
  | 'LOSS'
  | 'PAUSE'
  | 'RESUME'
  | 'REPORT'
  | 'FINISH'
  | 'RESET'
  | 'UNKNOWN';

export interface RuntimeGuidedModeInput {
  readonly type: RuntimeGuidedInputType;
}

export interface RuntimeGuidedModeResult {
  readonly state: GuidedOperationState;
  readonly accepted: boolean;
  readonly message: string;
  readonly nextAction: string;
  readonly runtimeEvent: string;
}

/**
 * Adapter between runtime commands and GuidedOperationMode workflow.
 *
 * This coordinator keeps RuntimeKernel/main.ts decoupled from the guided
 * workflow internals. It can be plugged into CLI, REPL, API, or tests without
 * changing the domain workflow.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeGuidedModeCoordinator {
  public constructor(
    private readonly mode: GuidedOperationMode = new GuidedOperationMode(false),
  ) {}

  public current(): GuidedOperationState {
    return this.mode.current();
  }

  public handle(input: RuntimeGuidedModeInput): RuntimeGuidedModeResult {
    const command = this.toCommand(input.type);

    if (command === null) {
      return {
        state: this.mode.current(),
        accepted: false,
        message: 'Comando não reconhecido pelo fluxo guiado.',
        nextAction: 'Usar comandos válidos: setup, start, win, loss, pause, resume, report, finish.',
        runtimeEvent: 'GUIDED_UNKNOWN',
      };
    }

    const result = this.mode.handle(command);

    return {
      state: result.state,
      accepted: result.accepted,
      message: result.message,
      nextAction: result.nextAction,
      runtimeEvent: this.runtimeEvent(command, result),
    };
  }

  private toCommand(type: RuntimeGuidedInputType): GuidedOperationCommand | null {
    if (type === 'PROFILE_LOADED') return 'PROFILE_LOADED';
    if (type === 'START') return 'START_SESSION';
    if (type === 'WIN') return 'REGISTER_WIN';
    if (type === 'LOSS') return 'REGISTER_LOSS';
    if (type === 'PAUSE') return 'PAUSE_SESSION';
    if (type === 'RESUME') return 'RESUME_SESSION';
    if (type === 'REPORT') return 'GENERATE_REPORT';
    if (type === 'FINISH') return 'FINISH_SESSION';
    if (type === 'RESET') return 'RESET';

    return null;
  }

  private runtimeEvent(
    command: GuidedOperationCommand,
    result: GuidedOperationResult,
  ): string {
    if (!result.accepted) {
      return `GUIDED_REJECTED_${command}`;
    }

    return `GUIDED_ACCEPTED_${command}`;
  }
}
TS

python - <<'PY'
from pathlib import Path

p = Path("src/application/session/index.ts")
s = p.read_text() if p.exists() else ""

line = "export * from './RuntimeGuidedModeCoordinator';\n"
if line not in s:
    s += line

p.write_text(s)
PY

cat > tests/runtime-guided-mode-coordinator.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeGuidedModeCoordinator,
} = require('../dist/application/session');

test('RuntimeGuidedModeCoordinator starts requiring profile', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  assert.equal(coordinator.current(), 'SETUP_REQUIRED');

  const result = coordinator.handle({ type: 'START' });

  assert.equal(result.accepted, false);
  assert.equal(result.state, 'SETUP_REQUIRED');
  assert.match(result.runtimeEvent, /GUIDED_REJECTED/);
});

test('RuntimeGuidedModeCoordinator loads profile and starts session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  const loaded = coordinator.handle({ type: 'PROFILE_LOADED' });
  const started = coordinator.handle({ type: 'START' });

  assert.equal(loaded.accepted, true);
  assert.equal(started.accepted, true);
  assert.equal(started.state, 'SESSION_ACTIVE');
  assert.equal(started.runtimeEvent, 'GUIDED_ACCEPTED_START_SESSION');
});

test('RuntimeGuidedModeCoordinator accepts win and loss in active session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  assert.equal(coordinator.handle({ type: 'WIN' }).accepted, true);
  assert.equal(coordinator.handle({ type: 'LOSS' }).accepted, true);
  assert.equal(coordinator.current(), 'SESSION_ACTIVE');
});

test('RuntimeGuidedModeCoordinator pauses and resumes session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  const paused = coordinator.handle({ type: 'PAUSE' });
  const resumed = coordinator.handle({ type: 'RESUME' });

  assert.equal(paused.state, 'SESSION_PAUSED');
  assert.equal(resumed.state, 'SESSION_ACTIVE');
});

test('RuntimeGuidedModeCoordinator generates report and finishes', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  const report = coordinator.handle({ type: 'REPORT' });
  const finish = coordinator.handle({ type: 'FINISH' });

  assert.equal(report.accepted, true);
  assert.equal(finish.accepted, true);
  assert.equal(finish.state, 'SESSION_FINISHED');
});

test('RuntimeGuidedModeCoordinator rejects unknown input safely', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  const result = coordinator.handle({ type: 'UNKNOWN' });

  assert.equal(result.accepted, false);
  assert.equal(result.runtimeEvent, 'GUIDED_UNKNOWN');
});
JS

python - <<'PY'
import json
from pathlib import Path

path = Path("install/registry/sprints.json")
registry = json.loads(path.read_text())

registry.setdefault("sprints", {})["sprint-070"] = {
    "name": "Runtime Guided Mode Wiring",
    "script": "run-sprint-070.sh",
    "channel": "stable",
    "version": "1.0.0",
    "dependencies": ["sprint-069"],
    "description": "Adds a runtime-facing coordinator for guided operation mode commands."
}

path.write_text(json.dumps(registry, indent=2) + "\n")
PY

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git add src/application/session/RuntimeGuidedModeCoordinator.ts src/application/session/index.ts tests/runtime-guided-mode-coordinator.test.js install/registry/sprints.json
git add -f install/sprints/run-sprint-070.sh

git commit -m "feat(session): add runtime guided mode coordinator"
git push -u origin "$BRANCH"

git checkout main
git pull origin main
git merge --no-ff "$BRANCH" -m "merge: sprint 070 runtime guided mode wiring"

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true
git push origin main

echo "== Sprint 070 completed and merged successfully =="
echo "Next:"
echo "./install/bootstrap/rlsys sprint-071"
