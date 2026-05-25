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
