'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACTIVE_STATES = new Set(['RUNNING', 'PAUSED', 'READY', 'STARTED']);
const FINAL_STATES = new Set(['FINISHED', 'COMPLETED', 'CLOSED', 'FINALIZED']);

function normalizeState(value) {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : 'UNKNOWN';
}

function resolveSnapshotPath() {
  const envPath =
    process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SESSION_SNAPSHOT_PATH;

  if (envPath && envPath.trim().length > 0) return envPath;

  return path.join(process.cwd(), 'data', 'paper-runtime', 'session-snapshot.json');
}

function readSnapshot(snapshotPath) {
  try {
    if (!fs.existsSync(snapshotPath)) {
      return { ok: false, reason: 'SNAPSHOT_NOT_FOUND', snapshot: null };
    }

    const raw = fs.readFileSync(snapshotPath, 'utf8').trim();

    if (raw.length === 0) {
      return { ok: false, reason: 'SNAPSHOT_EMPTY', snapshot: null };
    }

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'SNAPSHOT_INVALID_SHAPE', snapshot: null };
    }

    return { ok: true, reason: 'SNAPSHOT_LOADED', snapshot: parsed };
  } catch (error) {
    return {
      ok: false,
      reason: 'SNAPSHOT_CORRUPTED',
      errorMessage: error instanceof Error ? error.message : String(error),
      snapshot: null
    };
  }
}

function detectState(snapshot) {
  return normalizeState(
    snapshot.state ||
    snapshot.status ||
    snapshot.sessionState ||
    snapshot.runtimeState ||
    snapshot.phase
  );
}

function isGraceful(snapshot) {
  if (typeof snapshot.gracefulShutdown === 'boolean') return snapshot.gracefulShutdown;
  if (typeof snapshot.safeShutdown === 'boolean') return snapshot.safeShutdown;
  if (typeof snapshot.shutdownGraceful === 'boolean') return snapshot.shutdownGraceful;
  if (typeof snapshot.cleanShutdown === 'boolean') return snapshot.cleanShutdown;
  return false;
}

function classify(state, graceful) {
  if (!ACTIVE_STATES.has(state)) return 'NO_RECOVERY';
  if (state === 'RUNNING' && graceful === false) return 'ABRUPT_RUNNING';
  if (state === 'PAUSED' && graceful === false) return 'ABRUPT_PAUSED';
  if (graceful === false) return 'ABRUPT_ACTIVE';
  if (state === 'RUNNING') return 'GRACEFUL_RUNNING';
  if (state === 'PAUSED') return 'GRACEFUL_PAUSED';
  return 'RECOVERABLE_ACTIVE';
}

function recoverPaperRuntimeSnapshot() {
  const snapshotPath = resolveSnapshotPath();
  const loaded = readSnapshot(snapshotPath);

  if (!loaded.ok) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'NO_SNAPSHOT',
      reason: loaded.reason,
      snapshotPath
    };
  }

  const snapshot = loaded.snapshot;
  const state = detectState(snapshot);
  const graceful = isGraceful(snapshot);

  if (FINAL_STATES.has(state)) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'FINALIZED_SESSION',
      reason: 'SNAPSHOT_ALREADY_FINALIZED',
      detectedState: state,
      snapshotPath
    };
  }

  if (!ACTIVE_STATES.has(state)) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'NO_RECOVERY',
      reason: 'SNAPSHOT_NOT_RECOVERABLE',
      detectedState: state,
      snapshotPath
    };
  }

  const decision = classify(state, graceful);
  const now = new Date().toISOString();

  const recoveredSnapshot = {
    ...snapshot,
    state: 'PAUSED',
    status: 'PAUSED',
    sessionState: 'PAUSED',
    gracefulShutdown: false,
    updatedAt: now,
    recovery: {
      recovered: true,
      recoveredAt: now,
      originalState: state,
      restoredState: 'PAUSED',
      decision,
      requiresHumanConfirmation: true,
      reason: 'SAFE_RECOVERY_FROM_PREVIOUS_SESSION'
    }
  };

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(recoveredSnapshot, null, 2)}\n`, 'utf8');

  return {
    recovered: true,
    action: 'RESTORE_AS_PAUSED',
    decision,
    detectedState: state,
    restoredState: 'PAUSED',
    requiresHumanConfirmation: true,
    snapshotPath
  };
}

function runPaperRuntimeSnapshotRecovery() {
  const result = recoverPaperRuntimeSnapshot();

  if (result.recovered === true) {
    console.log(`Recovery decision: ${result.decision}`);
    console.log(`Recovery action: ${result.action}`);
    console.log(`Recovery restored state: ${result.restoredState}`);
    console.log('Recovery requires human confirmation: true');
  }

  return result;
}

module.exports = {
  recoverPaperRuntimeSnapshot,
  runPaperRuntimeSnapshotRecovery,
  normalizeState,
  classify
};
