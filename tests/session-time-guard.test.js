import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionTimeGuard } from '../dist/domain/bankroll/session-time/index.js';

test('SessionTimeGuard returns PAPER_COMPATIVEL when session time is inside institutional policy', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 0,
    evaluatedAtEpochMs: 30 * 60_000,
    policy: {
      maxSessionMinutes: 90,
      warningThresholdMinutes: 75,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'SESSION_TIME_WITHIN_LIMIT');
    assert.equal(result.value.elapsedMinutes, 30);
    assert.equal(result.value.remainingMinutes, 60);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('SessionTimeGuard returns AGUARDAR when session approaches institutional time limit', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 0,
    evaluatedAtEpochMs: 75 * 60_000,
    policy: {
      maxSessionMinutes: 90,
      warningThresholdMinutes: 75,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'SESSION_TIME_APPROACHING_LIMIT');
    assert.equal(result.value.elapsedMinutes, 75);
    assert.equal(result.value.remainingMinutes, 15);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('SessionTimeGuard returns NAO_UTILIZAR when session reaches institutional time limit', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 0,
    evaluatedAtEpochMs: 90 * 60_000,
    policy: {
      maxSessionMinutes: 90,
      warningThresholdMinutes: 75,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'SESSION_TIME_LIMIT_REACHED');
    assert.equal(result.value.elapsedMinutes, 90);
    assert.equal(result.value.remainingMinutes, 0);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('SessionTimeGuard returns NAO_UTILIZAR when evaluated time exceeds session limit', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 0,
    evaluatedAtEpochMs: 120 * 60_000,
    policy: {
      maxSessionMinutes: 90,
      warningThresholdMinutes: 75,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'SESSION_TIME_LIMIT_REACHED');
    assert.equal(result.value.elapsedMinutes, 120);
    assert.equal(result.value.remainingMinutes, 0);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('SessionTimeGuard returns Result/Either error object on invalid chronological input', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 120 * 60_000,
    evaluatedAtEpochMs: 60 * 60_000,
    policy: {
      maxSessionMinutes: 90,
      warningThresholdMinutes: 75,
    },
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_SESSION_TIME_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
  }
});

test('SessionTimeGuard returns Result/Either error object on invalid policy', () => {
  const guard = new SessionTimeGuard();

  const result = guard.evaluate({
    sessionStartedAtEpochMs: 0,
    evaluatedAtEpochMs: 30 * 60_000,
    policy: {
      maxSessionMinutes: 60,
      warningThresholdMinutes: 90,
    },
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_SESSION_TIME_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
  }
});
