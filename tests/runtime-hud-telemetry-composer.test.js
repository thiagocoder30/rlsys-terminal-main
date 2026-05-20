const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeHudTelemetryComposer,
} = require('../dist/application/operator');

function memory(state, lag) {
  return {
    state,
    heapUsedBytes: 1000,
    heapTotalBytes: 2000,
    heapUsageRatio: 0.5,
    rssBytes: 3000,
    eventLoopLagMs: lag,
    sampledAtEpochMs: 1,
    reason: 'memory sample',
  };
}

function stress(verdict) {
  return {
    verdict,
    samples: [],
    totalIterations: 10,
    maxHeapDeltaBytes: 100,
    maxLatencyMs: 20,
    rejectedEvents: 0,
    blockedEvents: 0,
    reason: 'stress report',
  };
}

test('RuntimeHudTelemetryComposer produces healthy HUD snapshot', () => {
  const composer = new RuntimeHudTelemetryComposer();

  const result = composer.compose({
    lifecycleState: 'NO_GO',
    verdict: 'NO_GO',
    reason: 'SNAPSHOT_REVIEW',
    paperBalance: 1000,
    drawdown: 0,
    snapshotStatus: 'REVIEW',
    freezeStatus: 'OK',
    lastTrigger: 'ENTROPY_DRIFT',
    lastReason: 'snapshot under review',
    memory: memory('MEMORY_OK', 12),
    stress: stress('STRESS_PASSED'),
  });

  assert.equal(result.snapshot.runtimeStatus, 'HEALTHY');
  assert.equal(result.snapshot.latencyMs, 12);
  assert.match(result.snapshot.lastReason, /lifecycle=NO_GO/);
  assert.equal(result.stressVerdict, 'STRESS_PASSED');
});

test('RuntimeHudTelemetryComposer marks degraded runtime on memory review', () => {
  const composer = new RuntimeHudTelemetryComposer();

  const result = composer.compose({
    lifecycleState: 'REVIEW',
    verdict: 'REVIEW',
    reason: 'MEMORY_REVIEW',
    paperBalance: 1000,
    drawdown: 5,
    snapshotStatus: 'VALID',
    freezeStatus: 'OK',
    lastTrigger: 'EVENT_LOOP_LAG',
    lastReason: 'runtime lag review',
    memory: memory('MEMORY_REVIEW', 275),
    stress: stress('STRESS_PASSED'),
  });

  assert.equal(result.snapshot.runtimeStatus, 'DEGRADED');
  assert.equal(result.snapshot.latencyMs, 275);
});

test('RuntimeHudTelemetryComposer marks critical runtime on stress failure', () => {
  const composer = new RuntimeHudTelemetryComposer();

  const result = composer.compose({
    lifecycleState: 'FREEZE',
    verdict: 'FREEZE',
    reason: 'STRESS_FAILED',
    paperBalance: 980,
    drawdown: 20,
    snapshotStatus: 'VALID',
    freezeStatus: 'FREEZE_TRIGGERED',
    lastTrigger: 'GC_STORM',
    lastReason: 'stress failed',
    memory: memory('MEMORY_OK', 100),
    stress: stress('STRESS_FAILED'),
  });

  assert.equal(result.snapshot.runtimeStatus, 'CRITICAL');
  assert.match(result.reason, /stress=STRESS_FAILED/);
});

test('RuntimeHudTelemetryComposer keeps bounded DTO shape for OperatorHudFormatter', () => {
  const composer = new RuntimeHudTelemetryComposer();

  const result = composer.compose({
    lifecycleState: 'LOCKED',
    verdict: 'LOCKED',
    reason: 'DRAWDOWN_LOCKED',
    paperBalance: 900,
    drawdown: 100,
    snapshotStatus: 'REVIEW',
    freezeStatus: 'OK',
    lastTrigger: 'DRAWDOWN_VELOCITY',
    lastReason: 'locked by drawdown velocity',
    memory: memory('MEMORY_CRITICAL', 900),
    stress: stress('STRESS_REVIEW'),
  });

  assert.equal(typeof result.snapshot.verdict, 'string');
  assert.equal(typeof result.snapshot.paperBalance, 'number');
  assert.equal(typeof result.snapshot.latencyMs, 'number');
  assert.equal(result.snapshot.runtimeStatus, 'CRITICAL');
});
