'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyRuntimeOrchestrator } = require('../../../src/domain/strategy/StrategyRuntimeOrchestrator');

function createLedger(outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-runtime-orchestrator');

  assert.equal(created.ok, true);

  let ledger = created.value;

  for (let index = 0; index < outcomes.length; index += 1) {
    const result = ledgerEngine.appendResult({
      ledger,
      outcome: outcomes[index],
      roundIndex: index + 1
    });

    assert.equal(result.status, 'STRATEGY_RESULT_RECORDED');
    ledger = result.ledger;
  }

  return ledger;
}

test('returns execution action when full strategy runtime context is strong', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger([]);

  const result = orchestrator.evaluate({
    ledger,
    strategyId: 'fusion-reduzida',
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  });

  assert.equal(result.status, 'STRATEGY_RUNTIME_READY');
  assert.equal(result.displayStatus, 'EXECUCAO_AUTORIZADA');
  assert.equal(result.displayAction, 'ENTRAR');
  assert.equal(result.cooldown.status, 'STRATEGY_AVAILABLE');
  assert.equal(result.recovery.status, 'STRATEGY_RECOVERY_APPROVED');
  assert.equal(result.compatibility.status, 'PAPER_COMPATIBLE');
  assert.equal(result.recommendation.status, 'EXECUTION_AUTHORIZED');
  assert.equal(result.explanation.status, 'STRATEGY_EXPLANATION_READY');
  assert.equal(result.statusView.status, 'STRATEGY_STATUS_READY');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('returns wait action when strategy is in cooldown after loss', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger(['LOSS']);

  const result = orchestrator.evaluate({
    ledger,
    currentRoundIndex: 1,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  });

  assert.equal(result.status, 'STRATEGY_RUNTIME_BLOCKED');
  assert.equal(result.displayStatus, 'BLOQUEADO');
  assert.equal(result.displayAction, 'NAO_UTILIZAR');
  assert.equal(result.cooldown.status, 'STRATEGY_COOLDOWN');
  assert.ok(result.reasons.includes('strategy_loss_cooldown_active'));
  assert.equal(result.liveGate, 'BLOCKED');
});

test('returns blocked action when supervisor veto is active', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger([]);

  const result = orchestrator.evaluate({
    ledger,
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8,
    supervisorVetoActive: true
  });

  assert.equal(result.status, 'STRATEGY_RUNTIME_BLOCKED');
  assert.equal(result.displayAction, 'NAO_UTILIZAR');
  assert.ok(result.reasons.includes('supervisor_veto_active'));
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('returns observe action when compatibility is moderate', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger([]);

  const result = orchestrator.evaluate({
    ledger,
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.7,
    operatorReadinessScore: 0.7,
    liveConsensusScore: 0.65,
    riskScore: 0.25,
    strategyDoctrineScore: 0.55,
    memoryTrustScore: 0.5
  });

  assert.equal(result.status, 'STRATEGY_RUNTIME_READY');
  assert.equal(result.displayStatus, 'OBSERVAR');
  assert.equal(result.displayAction, 'AGUARDAR');
  assert.equal(result.compatibility.status, 'OBSERVE');
  assert.equal(result.recommendation.status, 'OBSERVE');
});

test('blocks live money invariant violation from ledger', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger([]);

  const result = orchestrator.evaluate({
    ledger: {
      ...ledger,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    },
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  });

  assert.equal(result.status, 'STRATEGY_RUNTIME_BLOCKED');
  assert.equal(result.displayAction, 'NAO_UTILIZAR');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.ok(result.reasons.includes('live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const result = new StrategyRuntimeOrchestrator().evaluate(null);

  assert.equal(result.status, 'STRATEGY_RUNTIME_BLOCKED');
  assert.equal(result.displayAction, 'NAO_UTILIZAR');
  assert.equal(result.paperGate, 'BLOCKED');
  assert.ok(result.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const orchestrator = new StrategyRuntimeOrchestrator();
  const ledger = createLedger([]);
  const input = {
    ledger,
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  };

  const first = orchestrator.evaluate(input);
  const second = orchestrator.evaluate(input);

  assert.deepEqual(first, second);
});
