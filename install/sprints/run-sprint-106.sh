#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-106-operator-discipline-guard"
COMMIT_MSG="feat(runtime): add operator discipline guard"
SPRINT_ID="106"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

mkdir -p logs /sdcard/Download 2>/dev/null || true

LOG_FILE="logs/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_LOG_FILE="/sdcard/Download/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"

exec > >(tee -a "$LOG_FILE" "$DOWNLOAD_LOG_FILE" 2>/dev/null || tee -a "$LOG_FILE") 2>&1

finish() {
  code="$?"

  echo ""
  echo "============================================================"

  if [ "$code" -eq 0 ]; then
    echo "Sprint ${SPRINT_ID} SUCESSO"
  else
    echo "Sprint ${SPRINT_ID} FALHOU"
  fi

  echo "Status: $code"
  echo "Log local: $LOG_FILE"
  echo "Log Download: $DOWNLOAD_LOG_FILE"

  echo "============================================================"

  exit "$code"
}

trap finish EXIT

echo "== RL.SYS CORE :: Sprint 106 =="
echo "== Operator Discipline Guard =="

[ -d .git ] || {
  echo "Execute na raiz do repositório"
  exit 1
}

echo "== Sincronizando repositório =="

git fetch origin main

git checkout main
git reset --hard origin/main

echo "== Validando dependências =="

if [ ! -f scripts/paper-runtime-ledger-service.js ]; then
  echo "ERRO: Sprint 104 ausente."
  echo "paper-runtime-ledger-service.js não encontrado."
  exit 1
fi

if [ ! -f scripts/paper-runtime-session-report-service.js ]; then
  echo "WARN: Sprint 105 não encontrada."
  echo "Continuando porque Sprint 106 depende apenas do ledger."
fi

echo "== Criando branch da Sprint =="

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/paper-runtime-operator-discipline-guard.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  resolveLedgerPath,
  readLedger
} = require('./paper-runtime-ledger-service');

function resolveDisciplineStatePath() {
  return process.env.RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'operator-discipline.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyDisciplineState() {
  return {
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    recentCommands: [],
    warnings: [],
    lock: {
      active: false,
      reason: null,
      createdAt: null
    }
  };
}

function readDisciplineState(
  filePath = resolveDisciplineStatePath()
) {
  try {
    if (!fs.existsSync(filePath)) {
      return createEmptyDisciplineState();
    }

    const raw = fs.readFileSync(
      filePath,
      'utf8'
    ).trim();

    if (raw.length === 0) {
      return createEmptyDisciplineState();
    }

    const parsed = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return createEmptyDisciplineState();
    }

    if (!Array.isArray(parsed.recentCommands)) {
      parsed.recentCommands = [];
    }

    if (!Array.isArray(parsed.warnings)) {
      parsed.warnings = [];
    }

    if (!parsed.lock || typeof parsed.lock !== 'object') {
      parsed.lock = {
        active: false,
        reason: null,
        createdAt: null
      };
    }

    return parsed;
  } catch {
    return createEmptyDisciplineState();
  }
}

function writeDisciplineState(
  state,
  filePath = resolveDisciplineStatePath()
) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });

  fs.writeFileSync(
    filePath,
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  );
}

function getLossStreak(entries) {
  let streak = 0;

  for (
    let index = entries.length - 1;
    index >= 0;
    index -= 1
  ) {
    const entry = entries[index];

    if (!entry || entry.type !== 'LOSS') {
      break;
    }

    streak += 1;
  }

  return streak;
}

function pruneRecentCommands(
  commands,
  windowMs,
  nowMs
) {
  return commands.filter((entry) => {
    if (
      !entry ||
      typeof entry.atMs !== 'number'
    ) {
      return false;
    }

    return nowMs - entry.atMs <= windowMs;
  });
}

function evaluateOperatorDiscipline(input) {
  const command = String(
    input.command || ''
  ).trim().toLowerCase();

  const ledger = input.ledger || {
    entries: [],
    summary: {}
  };

  const state =
    input.state ||
    createEmptyDisciplineState();

  const nowMs =
    typeof input.nowMs === 'number'
      ? input.nowMs
      : Date.now();

  const entries = Array.isArray(ledger.entries)
    ? ledger.entries
    : [];

  const summary = ledger.summary || {};

  const lossStreak = getLossStreak(entries);

  const maxDrawdown =
    typeof summary.maxDrawdown === 'number'
      ? summary.maxDrawdown
      : 0;

  const recentCommands = pruneRecentCommands(
    state.recentCommands,
    60000,
    nowMs
  );

  recentCommands.push({
    command,
    atMs: nowMs,
    at: new Date(nowMs).toISOString()
  });

  const warnings = [];

  let blocked = false;
  let reason = null;

  if (lossStreak >= 3) {
    warnings.push(
      'DISCIPLINE_LOSS_STREAK'
    );
  }

  if (recentCommands.length >= 8) {
    warnings.push(
      'DISCIPLINE_COMMAND_VELOCITY'
    );
  }

  if (
    (command === 'resume' ||
      command === 'start') &&
    lossStreak >= 2
  ) {
    warnings.push(
      'DISCIPLINE_UNSAFE_RESUME_AFTER_LOSSES'
    );

    blocked = true;

    reason =
      'UNSAFE_RESUME_AFTER_LOSSES';
  }

  if (
    (command === 'resume' ||
      command === 'start') &&
    maxDrawdown >= 10
  ) {
    warnings.push(
      'DISCIPLINE_DRAWDOWN_PRESSURE'
    );

    blocked = true;

    reason =
      reason || 'DRAWDOWN_PRESSURE';
  }

  if (
    state.lock &&
    state.lock.active === true &&
    command !== 'pause' &&
    command !== 'status' &&
    command !== 'ledger' &&
    command !== 'bankroll' &&
    command !== 'report' &&
    command !== 'finish' &&
    command !== 'exit'
  ) {
    blocked = true;

    reason =
      state.lock.reason ||
      'DISCIPLINE_LOCK_ACTIVE';

    warnings.push(
      'DISCIPLINE_LOCK_ACTIVE'
    );
  }

  const nextState = {
    ...state,
    updatedAt: new Date(nowMs).toISOString(),
    recentCommands,
    warnings: [
      ...state.warnings,
      ...warnings.map((warning) => ({
        warning,
        command,
        at: new Date(nowMs).toISOString()
      }))
    ].slice(-100),
    lock: {
      active:
        blocked ||
        (
          state.lock &&
          state.lock.active === true
        ),
      reason: blocked
        ? reason
        : (
            state.lock
              ? state.lock.reason
              : null
          ),
      createdAt: blocked
        ? new Date(nowMs).toISOString()
        : (
            state.lock
              ? state.lock.createdAt
              : null
          )
    }
  };

  return {
    ok: true,
    blocked,
    reason,
    warnings,
    lossStreak,
    maxDrawdown,
    commandVelocity:
      recentCommands.length,
    state: nextState
  };
}

function inspectOperatorCommand(command) {
  const disciplinePath =
    resolveDisciplineStatePath();

  const state =
    readDisciplineState(
      disciplinePath
    );

  const ledger =
    readLedger(
      resolveLedgerPath()
    );

  const result =
    evaluateOperatorDiscipline({
      command,
      ledger,
      state,
      nowMs: Date.now()
    });

  writeDisciplineState(
    result.state,
    disciplinePath
  );

  return result;
}

function formatDisciplineResult(result) {
  const lines = [];

  if (result.warnings.length > 0) {
    lines.push(
      'RL.SYS OPERATOR DISCIPLINE GUARD'
    );

    for (const warning of result.warnings) {
      lines.push(`warning: ${warning}`);
    }

    lines.push(
      `lossStreak: ${result.lossStreak}`
    );

    lines.push(
      `maxDrawdown: ${result.maxDrawdown}`
    );

    lines.push(
      `commandVelocity: ${result.commandVelocity}`
    );
  }

  if (result.blocked) {
    lines.push(
      `discipline block: ${result.reason}`
    );

    lines.push(
      'action: command rejected for operator safety'
    );
  }

  return lines.join('\n');
}

module.exports = {
  resolveDisciplineStatePath,
  createEmptyDisciplineState,
  readDisciplineState,
  writeDisciplineState,
  getLossStreak,
  evaluateOperatorDiscipline,
  inspectOperatorCommand,
  formatDisciplineResult
};
EOF

cat > scripts/paper-runtime-operator-discipline-preload.js <<'EOF'
'use strict';

const readline = require('node:readline');

const {
  inspectOperatorCommand,
  formatDisciplineResult
} = require(
  './paper-runtime-operator-discipline-guard'
);

function shouldInspectCommand(line) {
  const command = String(
    line || ''
  ).trim().split(/\s+/)[0].toLowerCase();

  return command.length > 0;
}

function handleOperatorDisciplineCommand(rawLine) {
  const line = String(
    rawLine || ''
  ).trim();

  if (!shouldInspectCommand(line)) {
    return {
      inspected: false,
      blocked: false
    };
  }

  const result =
    inspectOperatorCommand(line);

  const formatted =
    formatDisciplineResult(result);

  if (formatted.length > 0) {
    console.log(formatted);
  }

  return {
    inspected: true,
    blocked: result.blocked,
    reason: result.reason
  };
}

function installOperatorDisciplinePreload() {
  if (
    globalThis.__rlsysOperatorDisciplinePreloadInstalled === true
  ) {
    return;
  }

  globalThis.__rlsysOperatorDisciplinePreloadInstalled = true;

  const originalCreateInterface =
    readline.createInterface.bind(readline);

  readline.createInterface =
    function patchedCreateInterface(...args) {
      const rl =
        originalCreateInterface(...args);

      const originalOn =
        rl.on.bind(rl);

      rl.on =
        function patchedOn(
          eventName,
          listener
        ) {
          if (eventName !== 'line') {
            return originalOn(
              eventName,
              listener
            );
          }

          return originalOn(
            'line',
            function wrappedLineListener(line) {
              const result =
                handleOperatorDisciplineCommand(
                  line
                );

              if (result.blocked) {
                return undefined;
              }

              return listener.call(
                this,
                line
              );
            }
          );
        };

      return rl;
    };
}

installOperatorDisciplinePreload();

module.exports = {
  handleOperatorDisciplineCommand,
  installOperatorDisciplinePreload
};
EOF

python3 <<'PY'
from pathlib import Path

target = Path(
    "scripts/paper-runtime-session.js"
)

if not target.exists():
    raise SystemExit(
        "ERROR: scripts/paper-runtime-session.js não encontrado"
    )

text = target.read_text()

preload = (
    "require('./paper-runtime-operator-discipline-preload');"
)

if preload not in text:
    lines = text.splitlines()

    insert_index = 0

    if lines and lines[0].startswith("#!"):
        insert_index = 1

    if (
        insert_index < len(lines)
        and lines[insert_index].strip()
        in ("'use strict';", '"use strict";')
    ):
        insert_index += 1
    else:
        lines.insert(
            insert_index,
            "'use strict';"
        )
        insert_index += 1

    lines.insert(
        insert_index,
        preload
    )

    text = (
        "\n".join(lines).rstrip()
        + "\n"
    )

target.write_text(text)
PY

cat > tests/paper-runtime-operator-discipline-guard.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createEmptyDisciplineState,
  getLossStreak,
  evaluateOperatorDiscipline
} = require(
  '../scripts/paper-runtime-operator-discipline-guard'
);

test(
  'getLossStreak counts only trailing losses',
  () => {
    assert.equal(
      getLossStreak([]),
      0
    );

    assert.equal(
      getLossStreak([
        { type: 'LOSS' },
        { type: 'LOSS' }
      ]),
      2
    );

    assert.equal(
      getLossStreak([
        { type: 'LOSS' },
        { type: 'WIN' },
        { type: 'LOSS' }
      ]),
      1
    );
  }
);

test(
  'evaluateOperatorDiscipline blocks unsafe resume after losses',
  () => {
    const result =
      evaluateOperatorDiscipline({
        command: 'resume',
        ledger: {
          entries: [
            { type: 'LOSS' },
            { type: 'LOSS' }
          ],
          summary: {
            maxDrawdown: 2
          }
        },
        state:
          createEmptyDisciplineState(),
        nowMs: 1000
      });

    assert.equal(
      result.blocked,
      true
    );

    assert.equal(
      result.reason,
      'UNSAFE_RESUME_AFTER_LOSSES'
    );
  }
);
EOF

cat > tests/paper-runtime-session-discipline-integration.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime discipline guard blocks unsafe resume',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-session-discipline-'
        )
      );

    const ledgerPath =
      path.join(
        dir,
        'paper-ledger.json'
      );

    const disciplinePath =
      path.join(
        dir,
        'operator-discipline.json'
      );

    const result =
      spawnSync(
        process.execPath,
        ['scripts/paper-runtime-session.js'],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          input:
            'loss 1\nloss 1\nresume\nexit\n',
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_LEDGER_PATH:
              ledgerPath,
            RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH:
              disciplinePath
          }
        }
      );

    const output =
      `${result.stdout || ''}${result.stderr || ''}`;

    assert.equal(
      result.status,
      0,
      output
    );

    assert.match(
      output,
      /discipline block: UNSAFE_RESUME_AFTER_LOSSES/
    );

    const state =
      JSON.parse(
        fs.readFileSync(
          disciplinePath,
          'utf8'
        )
      );

    assert.equal(
      state.lock.active,
      true
    );
  }
);
EOF

echo "== Validando preload =="

grep -q \
  "paper-runtime-operator-discipline-preload" \
  scripts/paper-runtime-session.js

grep -q \
  "readline" \
  scripts/paper-runtime-session.js

echo "== Syntax check =="

node --check \
  scripts/paper-runtime-operator-discipline-guard.js

node --check \
  scripts/paper-runtime-operator-discipline-preload.js

node --check \
  scripts/paper-runtime-session.js

echo "== Smoke test =="

TMP_DIR="$(mktemp -d)"

TMP_LEDGER="$TMP_DIR/paper-ledger.json"
TMP_DISCIPLINE="$TMP_DIR/operator-discipline.json"

printf 'loss 1\nloss 1\nresume\nexit\n' | \
RLSYS_PAPER_RUNTIME_LEDGER_PATH="$TMP_LEDGER" \
RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH="$TMP_DISCIPLINE" \
node scripts/paper-runtime-session.js \
| tee /tmp/rlsys-s106-smoke.log

grep \
  "discipline block: UNSAFE_RESUME_AFTER_LOSSES" \
  /tmp/rlsys-s106-smoke.log

echo "== Build =="

npm run build

echo "== Tests =="

npm test

git add .

git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

echo "== Mergeando Sprint 106 na main =="

git checkout main
git reset --hard origin/main

git merge --no-ff "$BRANCH" \
  -m "merge: sprint 106 operator discipline guard"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 106 concluída e mergeada na main =="
