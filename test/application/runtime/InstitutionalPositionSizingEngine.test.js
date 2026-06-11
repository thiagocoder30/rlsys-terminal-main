const assert = require('node:assert/strict');
const test = require('node:test');

const {
  InstitutionalPositionSizingEngine,
} = require('../../../dist/application/runtime/InstitutionalPositionSizingEngine.js');

test('InstitutionalPositionSizingEngine calcula stake base Pragmatic para banca 100', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.66,
    consensusRiskScore: 0.42,
    strategyAgreementLevel: 'MODERATE',
  });

  assert.equal(recommendation.decision, 'PAPER_STAKE_ALLOWED');
  assert.equal(recommendation.provider, 'PRAGMATIC');
  assert.equal(recommendation.tableMinBet, 0.1);
  assert.equal(recommendation.riskUnitAmount, 0.5);
  assert.equal(recommendation.recommendedStakeAmount, 0.8);
  assert.equal(recommendation.liveMoneyAuthorized, false);
});

test('InstitutionalPositionSizingEngine calcula stake Evolution respeitando ficha mínima 0.50', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.evolutionProfile(),
    consensusConfidenceScore: 0.66,
    consensusRiskScore: 0.42,
    strategyAgreementLevel: 'MODERATE',
  });

  assert.equal(recommendation.decision, 'PAPER_STAKE_ALLOWED');
  assert.equal(recommendation.provider, 'EVOLUTION');
  assert.equal(recommendation.tableMinBet, 0.5);
  assert.equal(recommendation.chipStep, 0.5);
  assert.equal(recommendation.recommendedStakeAmount, 1);
});

test('InstitutionalPositionSizingEngine aumenta stake apenas defensivamente em consenso forte', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.evolutionProfile(),
    consensusConfidenceScore: 0.84,
    consensusRiskScore: 0.28,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.decision, 'PAPER_STAKE_ALLOWED');
  assert.equal(recommendation.mode, 'STRONG');
  assert.equal(recommendation.riskUnitMultiplier, 2);
  assert.equal(recommendation.recommendedStakeAmount, 1);
  assert.equal(recommendation.stakePercent, 1);
});

test('InstitutionalPositionSizingEngine limita stake em consenso muito forte', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.93,
    consensusRiskScore: 0.2,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.mode, 'VERY_STRONG');
  assert.equal(recommendation.riskUnitMultiplier, 3);
  assert.equal(recommendation.recommendedStakeAmount, 1.5);
  assert.equal(recommendation.stakePercent, 1.5);
});

test('InstitutionalPositionSizingEngine bloqueia mesa incompatível com banca pequena', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 20,
    table: engine.evolutionProfile(),
    consensusConfidenceScore: 0.84,
    consensusRiskScore: 0.28,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.decision, 'NO_BET');
  assert.equal(recommendation.tableCompatible, false);
  assert.equal(recommendation.blockers.includes('BANKROLL_INCOMPATIBLE_WITH_TABLE_LIMIT'), true);
  assert.equal(recommendation.recommendedStakeAmount, 0);
});

test('InstitutionalPositionSizingEngine permite banca pequena em Pragmatic com mínimo 0.10', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 20,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.84,
    consensusRiskScore: 0.28,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.decision, 'PAPER_STAKE_ALLOWED');
  assert.equal(recommendation.recommendedStakeAmount, 0.2);
  assert.equal(recommendation.tableCompatible, true);
});

test('InstitutionalPositionSizingEngine reduz para LOW em drawdown protegido', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.evolutionProfile(),
    consensusConfidenceScore: 0.92,
    consensusRiskScore: 0.2,
    strategyAgreementLevel: 'STRONG',
    dailyDrawdownPercent: 2.5,
  });

  assert.equal(recommendation.mode, 'LOW');
  assert.equal(recommendation.drawdownProtected, true);
  assert.equal(recommendation.riskUnitMultiplier, 1);
  assert.equal(recommendation.warnings.includes('POSITION_DRAWDOWN_PROTECTION_ACTIVE'), true);
});

test('InstitutionalPositionSizingEngine limita agressividade após milestone 4%', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.93,
    consensusRiskScore: 0.2,
    strategyAgreementLevel: 'STRONG',
    currentMilestonePercent: 4,
  });

  assert.equal(recommendation.milestoneProtected, true);
  assert.equal(recommendation.riskUnitMultiplier, 1.5);
  assert.equal(recommendation.recommendedStakeAmount, 0.8);
  assert.equal(recommendation.warnings.includes('POSITION_MILESTONE_PROTECTION_ACTIVE'), true);
});

test('InstitutionalPositionSizingEngine bloqueia confiança baixa', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.5,
    consensusRiskScore: 0.3,
    strategyAgreementLevel: 'MODERATE',
  });

  assert.equal(recommendation.decision, 'NO_BET');
  assert.equal(recommendation.blockers.includes('POSITION_CONFIDENCE_BELOW_MINIMUM'), true);
});

test('InstitutionalPositionSizingEngine bloqueia risco alto', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 0.8,
    consensusRiskScore: 0.7,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.decision, 'NO_BET');
  assert.equal(recommendation.blockers.includes('POSITION_RISK_ABOVE_MAXIMUM'), true);
});

test('InstitutionalPositionSizingEngine suporta mesa customizada', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100,
    table: engine.customProfile(0.25, 0.25),
    consensusConfidenceScore: 0.84,
    consensusRiskScore: 0.28,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.provider, 'CUSTOM');
  assert.equal(recommendation.tableMinBet, 0.25);
  assert.equal(recommendation.chipStep, 0.25);
  assert.equal(recommendation.recommendedStakeAmount, 1);
});

test('InstitutionalPositionSizingEngine nunca autoriza dinheiro real', () => {
  const engine = new InstitutionalPositionSizingEngine();

  const recommendation = engine.recommend({
    bankroll: 100000,
    table: engine.pragmaticProfile(),
    consensusConfidenceScore: 1,
    consensusRiskScore: 0,
    strategyAgreementLevel: 'STRONG',
  });

  assert.equal(recommendation.paperOnly, true);
  assert.equal(recommendation.liveMoneyAuthorized, false);
  assert.equal(recommendation.productionMoneyAllowed, false);
  assert.equal(recommendation.operatorDecisionRequired, true);
  assert.equal(recommendation.supervisedRecommendationOnly, true);
  assert.ok(recommendation.hudSummary.includes('liveMoneyAuthorized=false'));
});
