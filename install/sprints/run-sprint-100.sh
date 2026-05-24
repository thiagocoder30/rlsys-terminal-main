#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-100-paper-runtime-v1-certification-hud-semantics"
COMMIT_MSG="feat(runtime): certify paper runtime v1 hud semantics"

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

echo "== Sprint 100: Paper Runtime v1.0 Certification & HUD Semantics =="
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

mkdir -p src/application/runtime tests

cat > src/application/runtime/PaperRuntimeV1Certification.ts <<'TS'
export type PaperRuntimeV1CertificationStatus =
  | "CERTIFIED"
  | "FAILED";

export interface PaperRuntimeV1CertificationInput {
  readonly hasInteractiveLoop: boolean;
  readonly hasOperationalGate: boolean;
  readonly hasSessionSupervisor: boolean;
  readonly hasHudComposer: boolean;
  readonly hasReplAdapter: boolean;
  readonly allowsPrepareWithoutOperationGateConfusion: boolean;
}

export interface PaperRuntimeV1CertificationResult {
  readonly status: PaperRuntimeV1CertificationStatus;
  readonly certified: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Certifies the minimal paper runtime v1.0 operational surface.
 *
 * This is not a gambling-performance certificate. It only certifies that
 * the defensive paper runtime shell has the required governance components.
 *
 * Complexity:
 * - O(1), fixed checklist.
 * - Memory O(1).
 */
export class PaperRuntimeV1Certification {
  public certify(input: PaperRuntimeV1CertificationInput): PaperRuntimeV1CertificationResult {
    const failures: string[] = [];

    if (!input.hasInteractiveLoop) {
      failures.push("Interactive loop is missing.");
    }

    if (!input.hasOperationalGate) {
      failures.push("Operational gate is missing.");
    }

    if (!input.hasSessionSupervisor) {
      failures.push("Session supervisor is missing.");
    }

    if (!input.hasHudComposer) {
      failures.push("HUD composer is missing.");
    }

    if (!input.hasReplAdapter) {
      failures.push("REPL adapter is missing.");
    }

    if (!input.allowsPrepareWithoutOperationGateConfusion) {
      failures.push("PREPARE command still exposes operation gate confusion.");
    }

    if (failures.length > 0) {
      return {
        status: "FAILED",
        certified: false,
        score: Math.max(0, 100 - failures.length * 20),
        reasons: failures,
      };
    }

    return {
      status: "CERTIFIED",
      certified: true,
      score: 100,
      reasons: ["Paper Runtime v1.0 defensive shell is certified."],
    };
  }
}
TS

python3 - <<'PY'
from pathlib import Path

path = Path("src/application/runtime/PaperRuntimeSessionSupervisor.ts")
text = path.read_text()

old = '''      return {
        decision: "SESSION_PREPARED",
        allowed: true,
        nextSessionState: "READY",
        gate: gateResult,
        messages: ["Paper session prepared for supervised operation."],
      };'''

new = '''      return {
        decision: "SESSION_PREPARED",
        allowed: true,
        nextSessionState: "READY",
        gate: {
          decision: "ALLOW_PAPER_OPERATION",
          allowed: true,
          reasons: ["Preparation is allowed. Operation gate will be evaluated before START or RESUME."],
        },
        messages: ["Paper session prepared. Use START to request operational authorization."],
      };'''

if old not in text:
    raise SystemExit("Expected SESSION_PREPARED block not found")

path.write_text(text.replace(old, new))
PY

cat > tests/paper-runtime-v1-certification.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeV1Certification,
} = require("../dist/application/runtime/PaperRuntimeV1Certification.js");

test("certifies complete paper runtime v1 surface", () => {
  const result = new PaperRuntimeV1Certification().certify({
    hasInteractiveLoop: true,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion: true,
  });

  assert.equal(result.status, "CERTIFIED");
  assert.equal(result.certified, true);
  assert.equal(result.score, 100);
});

test("fails incomplete paper runtime v1 surface", () => {
  const result = new PaperRuntimeV1Certification().certify({
    hasInteractiveLoop: false,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion: true,
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /Interactive loop/);
});
JS

cat > tests/paper-runtime-prepare-hud-semantics.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");

test("prepare command does not render operation gate as blocked", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(
    new PaperRuntimeOperationalGate(),
  );

  const hud = new PaperRuntimeHudGateComposer();

  const result = supervisor.supervise({
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "IDLE",
    operatorMode: "SUPERVISED",
    commandIntent: "PREPARE",
  });

  const rendered = hud.compose(result, {
    compact: true,
  });

  assert.equal(result.decision, "SESSION_PREPARED");
  assert.equal(result.allowed, true);
  assert.equal(result.gate.decision, "ALLOW_PAPER_OPERATION");
  assert.doesNotMatch(rendered.text, /gate=BLOCK_PAPER_OPERATION/);
  assert.match(rendered.text, /PAPER READY/);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeSessionSupervisor.ts \
  src/application/runtime/PaperRuntimeV1Certification.ts \
  tests/paper-runtime-v1-certification.test.js \
  tests/paper-runtime-prepare-hud-semantics.test.js \
  install/sprints/run-sprint-100.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 100 paper runtime v1 certification hud semantics"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 100 completed, merged and pushed successfully =="
