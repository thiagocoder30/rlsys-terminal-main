const assert = require('node:assert/strict');
const test = require('node:test');

const {
  InstitutionalMultiStrategyConsensusRuntime,
} = require('../../../dist/application/runtime/InstitutionalMultiStrategyConsensusRuntime.js');

test('InstitutionalMultiStrategyConsensusRuntime gera PAPER_ONLY com acordo forte entre Fusion e Triplicação', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const decision = runtime.evaluate([
    {
      strategyId: 'fusion-reduzida',
      source: 'FUSION_REDUZIDA',
      enabled: true,
      confidenceScore: 0.82,
      riskScore: 0.22,
      evidenceScore: 82,
      recencyScore: 80,
      suggestedMode: 'PAPER_ONLY',
    },
    {
      strategyId: 'triplicacao',
      source: 'TRIPLICACAO',
      enabled: true,
      confidenceScore: 0.8,
      riskScore: 0.24,
      evidenceScore: 78,
      recencyScore: 79,
      suggestedMode: 'PAPER_ONLY',
    },
  ]);

  assert.equal(decision.operationalMode, 'PAPER_ONLY');
  assert.equal(decision.acceptedInputCount, 2);
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.operatorDecisionRequired, true);
  assert.equal(decision.supervisedRecommendationOnly, true);
  assert.equal(decision.blockers.length, 0);
  assert.ok(decision.consensusScore >= 70);
  assert.ok(decision.hudSummary.includes('liveMoneyAuthorized=false'));
});

test('InstitutionalMultiStrategyConsensusRuntime mantém OBSERVE quando apenas Triplicação está aceita', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const decision = runtime.evaluate([
    {
      strategyId: 'triplicacao',
      source: 'TRIPLICACAO',
      enabled: true,
      confidenceScore: 0.88,
      riskScore: 0.18,
      evidenceScore: 90,
      suggestedMode: 'PAPER_ONLY',
    },
    {
      strategyId: 'fusion-reduzida',
      source: 'FUSION_REDUZIDA',
      enabled: true,
      confidenceScore: 0.81,
      riskScore: 0.2,
      evidenceScore: 85,
      blockers: ['FUSION_REDUZIDA_NOT_PAPER_READY'],
      suggestedMode: 'OBSERVE',
    },
  ]);

  assert.equal(decision.operationalMode, 'OBSERVE');
  assert.equal(decision.acceptedInputCount, 1);
  assert.equal(decision.blockers.includes('CONSENSUS_ACCEPTED_STRATEGIES_INSUFFICIENT'), true);
  assert.equal(decision.blockers.includes('CONSENSUS_REQUIRES_FUSION_AND_TRIPLICACAO'), true);
});

test('InstitutionalMultiStrategyConsensusRuntime fica BLOCKED sem inputs aceitos', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const decision = runtime.evaluate([
    {
      strategyId: 'triplicacao',
      source: 'TRIPLICACAO',
      enabled: true,
      confidenceScore: 0.3,
      riskScore: 0.8,
      evidenceScore: 30,
      blockers: ['TRIPLICACAO_WEAK'],
    },
  ]);

  assert.equal(decision.operationalMode, 'BLOCKED');
  assert.equal(decision.acceptedInputCount, 0);
  assert.equal(decision.blockers.includes('CONSENSUS_ACCEPTED_STRATEGIES_INSUFFICIENT'), true);
  assert.equal(decision.liveMoneyAuthorized, false);
});

test('InstitutionalMultiStrategyConsensusRuntime adapta análise avançada da Triplicação', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const signal = runtime.fromTriplicacaoAdvancedAnalysis({
    confidenceScore: 0.82,
    riskScore: 0.21,
    evidenceScore: 84,
    probabilityMode: 'PAPER_ONLY',
    reasons: ['TRIPLICACAO_ADVANCED_SELECTED:TC'],
  });

  assert.equal(signal.strategyId, 'triplicacao');
  assert.equal(signal.source, 'TRIPLICACAO');
  assert.equal(signal.enabled, true);
  assert.equal(signal.blockers?.length, 0);
  assert.equal(signal.suggestedMode, 'PAPER_ONLY');
});

test('InstitutionalMultiStrategyConsensusRuntime adapta Fusion Reduzida bloqueada como OBSERVE', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const signal = runtime.fromFusionReducedAnalysis({
    confidenceScore: 0.78,
    riskScore: 0.3,
    evidenceScore: 76,
    operationalMode: 'OBSERVE',
    reasons: ['FUSION_REGION_PRESSURE_MODERATE'],
  });

  assert.equal(signal.strategyId, 'fusion-reduzida');
  assert.equal(signal.source, 'FUSION_REDUZIDA');
  assert.equal(signal.enabled, true);
  assert.ok(signal.blockers?.includes('FUSION_REDUZIDA_NOT_PAPER_READY'));
  assert.equal(signal.suggestedMode, 'OBSERVE');
});

test('InstitutionalMultiStrategyConsensusRuntime nunca autoriza dinheiro real mesmo em consenso forte', () => {
  const runtime = new InstitutionalMultiStrategyConsensusRuntime();

  const decision = runtime.evaluate([
    {
      strategyId: 'fusion-reduzida',
      source: 'FUSION_REDUZIDA',
      enabled: true,
      confidenceScore: 1,
      riskScore: 0,
      evidenceScore: 100,
      recencyScore: 100,
    },
    {
      strategyId: 'triplicacao',
      source: 'TRIPLICACAO',
      enabled: true,
      confidenceScore: 1,
      riskScore: 0,
      evidenceScore: 100,
      recencyScore: 100,
    },
  ]);

  assert.equal(decision.operationalMode, 'PAPER_ONLY');
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.operatorDecisionRequired, true);
  assert.equal(decision.supervisedRecommendationOnly, true);
  assert.ok(decision.warnings.includes('LIVE_MONEY_REMAINS_BLOCKED'));
});
