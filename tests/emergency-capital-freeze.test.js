const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EmergencyCapitalFreeze,
  EmergencyFreezeStatus
} = require('../dist/domain/runtime/EmergencyCapitalFreeze.js');

test('returns BLOCKED on integrity failure', () => {
  const result = EmergencyCapitalFreeze.evaluate({
    dataIntegrityValid: false,
    runtimeHeartbeatAlive: true,
    snapshotAvailable: true,
    ledgerPersistenceHealthy: true,
    eventLoopLagMs: 10,
    memoryPressureCritical: false,
    ocrTimeoutDetected: false
  });

  assert.equal(result, EmergencyFreezeStatus.BLOCKED);
});

test('returns FREEZE_TRIGGERED on heartbeat failure', () => {
  const result = EmergencyCapitalFreeze.evaluate({
    dataIntegrityValid: true,
    runtimeHeartbeatAlive: false,
    snapshotAvailable: true,
    ledgerPersistenceHealthy: true,
    eventLoopLagMs: 10,
    memoryPressureCritical: false,
    ocrTimeoutDetected: false
  });

  assert.equal(result, EmergencyFreezeStatus.FREEZE_TRIGGERED);
});

test('returns FREEZE_TRIGGERED on memory pressure', () => {
  const result = EmergencyCapitalFreeze.evaluate({
    dataIntegrityValid: true,
    runtimeHeartbeatAlive: true,
    snapshotAvailable: true,
    ledgerPersistenceHealthy: true,
    eventLoopLagMs: 10,
    memoryPressureCritical: true,
    ocrTimeoutDetected: false
  });

  assert.equal(result, EmergencyFreezeStatus.FREEZE_TRIGGERED);
});

test('returns FREEZE_REVIEW on OCR timeout', () => {
  const result = EmergencyCapitalFreeze.evaluate({
    dataIntegrityValid: true,
    runtimeHeartbeatAlive: true,
    snapshotAvailable: true,
    ledgerPersistenceHealthy: true,
    eventLoopLagMs: 10,
    memoryPressureCritical: false,
    ocrTimeoutDetected: true
  });

  assert.equal(result, EmergencyFreezeStatus.FREEZE_REVIEW);
});

test('returns FREEZE_OK on healthy state', () => {
  const result = EmergencyCapitalFreeze.evaluate({
    dataIntegrityValid: true,
    runtimeHeartbeatAlive: true,
    snapshotAvailable: true,
    ledgerPersistenceHealthy: true,
    eventLoopLagMs: 10,
    memoryPressureCritical: false,
    ocrTimeoutDetected: false
  });

  assert.equal(result, EmergencyFreezeStatus.FREEZE_OK);
});
