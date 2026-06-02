const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalConsensusRuntime,
} = require('../dist/infrastructure/paper-operational/institutional-consensus-runtime');

function policy(overrides = {}) {
  return {
    minimumSignals: 5,
    minimumSupportScoreForReady: 0.55,
    minimumSupportScoreForCertified: 0.7,
    maximumBlockScoreForReady: 0.2,
    maximumObserveScoreForCertified: 0.2,
    requireReadinessGateSupport: true,
    ...overrides,
  };
}

function supportiveSignals() {
  return [
    { id: 'sig-warmup', kind: 'WARMUP', vote: 'SUPPORT', confidence: 0.9, weight: 1, explanation: 'warmup qualificado' },
    { id: 'sig-momentum', kind: 'MOMENTUM', vote: 'SUPPORT', confidence: 0.85, weight: 1, explanation: 'momentum estável' },
    { id: 'sig-volatility', kind: 'VOLATILITY', vote: 'OBSERVE', confidence: 0.35, weight: 0.8, explanation: 'volatilidade controlada' },
    { id: 'sig-cluster', kind: 'CLUSTER', vote: 'SUPPORT', confidence: 0.8, weight: 1, explanation: 'cluster contextual favorável' },
    { id: 'sig-readiness', kind: 'READINESS_GATE', vote: 'SUPPORT', confidence: 1, weight: 1.5, explanation: 'gate paper certificado' },
    { id: 'sig-operator', kind: 'OPERATOR', vote: 'SUPPORT', confidence: 0.9, weight: 1, explanation: 'operador estável' },
    { id: 'sig-performance', kind: 'PERFORMANCE', vote: 'SUPPORT', confidence: 0.8, weight: 1, explanation: 'performance paper saudável' },
  ];
}

test('InstitutionalConsensusRuntime returns certified consensus for aligned signals', () => {
  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-197',
    signals: supportiveSignals(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_CONSENSUS_CERTIFIED');
  assert.equal(result.value.readinessGateSupport, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('InstitutionalConsensusRuntime blocks without readiness gate support', () => {
  const signals = supportiveSignals().map((signal) => {
    if (signal.kind === 'READINESS_GATE') {
      return { ...signal, vote: 'OBSERVE', confidence: 0.5 };
    }

    return signal;
  });

  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-no-readiness-197',
    signals,
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_CONSENSUS_BLOCKED');
  assert.equal(result.value.readinessGateSupport, false);
});

test('InstitutionalConsensusRuntime blocks excessive block score', () => {
  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-blocked-197',
    signals: [
      ...supportiveSignals(),
      { id: 'sig-block-risk', kind: 'COOLDOWN', vote: 'BLOCK', confidence: 1, weight: 5, explanation: 'cooldown institucional ativo' },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_CONSENSUS_BLOCKED');
  assert.equal(result.value.blockScore > 0.2, true);
});

test('InstitutionalConsensusRuntime returns observe for weak support', () => {
  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-observe-197',
    signals: [
      { id: 'sig-warmup', kind: 'WARMUP', vote: 'OBSERVE', confidence: 0.4, weight: 1, explanation: 'warmup inconclusivo' },
      { id: 'sig-momentum', kind: 'MOMENTUM', vote: 'OBSERVE', confidence: 0.4, weight: 1, explanation: 'momentum fraco' },
      { id: 'sig-volatility', kind: 'VOLATILITY', vote: 'OBSERVE', confidence: 0.4, weight: 1, explanation: 'volatilidade neutra' },
      { id: 'sig-cluster', kind: 'CLUSTER', vote: 'OBSERVE', confidence: 0.4, weight: 1, explanation: 'cluster neutro' },
      { id: 'sig-readiness', kind: 'READINESS_GATE', vote: 'SUPPORT', confidence: 0.7, weight: 1, explanation: 'gate paper pronto' },
    ],
    policy: policy({ minimumSupportScoreForReady: 0.55 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_CONSENSUS_OBSERVE');
});

test('InstitutionalConsensusRuntime rejects live money flags before structural validation', () => {
  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-live-197',
    signals: [
      { id: 'x', kind: 'WARMUP', vote: 'SUPPORT', confidence: 1, weight: 1, explanation: 'x' },
    ],
    policy: policy({ minimumSignals: 1 }),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('InstitutionalConsensusRuntime rejects malformed signal', () => {
  const result = new InstitutionalConsensusRuntime().evaluate({
    sessionId: 'paper-consensus-invalid-197',
    signals: [
      { id: 'x', kind: 'WARMUP', vote: 'SUPPORT', confidence: 1, weight: 1, explanation: 'x' },
    ],
    policy: policy({ minimumSignals: 1 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_INSTITUTIONAL_CONSENSUS_INPUT');
});

test('institutional-consensus-runtime-demo emits certified consensus', () => {
  const result = spawnSync(process.execPath, ['scripts/institutional-consensus-runtime-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.sessionId, 'paper-consensus-demo');
  assert.equal(payload.decision, 'PAPER_CONSENSUS_CERTIFIED');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
