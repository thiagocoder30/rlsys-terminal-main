const test = require('node:test');
const assert = require('node:assert/strict');
const { EmotionalCooldownGuard } = require('../dist/domain/risk');

test('EmotionalCooldownGuard remains clear without risky behavior', () => {
  const guard = new EmotionalCooldownGuard();

  const result = guard.evaluate({
    consecutiveLosses: 0,
    attemptsAfterLoss: 0,
    millisecondsSinceLastLoss: 60_000,
    nowEpochMs: 1000,
  });

  assert.equal(result.state, 'COOLDOWN_CLEAR');
  assert.equal(result.lockedUntilEpochMs, null);
});

test('EmotionalCooldownGuard escalates to review after repeated losses', () => {
  const guard = new EmotionalCooldownGuard();

  const result = guard.evaluate({
    consecutiveLosses: 2,
    attemptsAfterLoss: 0,
    millisecondsSinceLastLoss: 60_000,
    nowEpochMs: 1000,
  });

  assert.equal(result.state, 'COOLDOWN_REVIEW');
  assert.match(result.reason, /operação emocional/);
});

test('EmotionalCooldownGuard locks after dangerous loss streak', () => {
  const guard = new EmotionalCooldownGuard();

  const result = guard.evaluate({
    consecutiveLosses: 3,
    attemptsAfterLoss: 1,
    millisecondsSinceLastLoss: 60_000,
    nowEpochMs: 1000,
  });

  assert.equal(result.state, 'COOLDOWN_LOCKED');
  assert.equal(result.lockedUntilEpochMs, 901000);
  assert.match(result.recommendedAction, /Pausar/);
});

test('EmotionalCooldownGuard locks after too many attempts after loss', () => {
  const guard = new EmotionalCooldownGuard();

  const result = guard.evaluate({
    consecutiveLosses: 1,
    attemptsAfterLoss: 4,
    millisecondsSinceLastLoss: 60_000,
    nowEpochMs: 1000,
  });

  assert.equal(result.state, 'COOLDOWN_LOCKED');
});

test('EmotionalCooldownGuard clears behavior outside recovery window', () => {
  const guard = new EmotionalCooldownGuard();

  const result = guard.evaluate({
    consecutiveLosses: 5,
    attemptsAfterLoss: 5,
    millisecondsSinceLastLoss: 10 * 60 * 1000,
    nowEpochMs: 1000,
  });

  assert.equal(result.state, 'COOLDOWN_CLEAR');
});

test('EmotionalCooldownGuard rejects invalid counters', () => {
  const guard = new EmotionalCooldownGuard();

  assert.throws(() => guard.evaluate({
    consecutiveLosses: -1,
    attemptsAfterLoss: 0,
    millisecondsSinceLastLoss: 0,
    nowEpochMs: 1000,
  }), /consecutiveLosses/);
});
