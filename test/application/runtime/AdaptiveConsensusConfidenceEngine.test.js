const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AdaptiveConsensusConfidenceEngine,
} = require('../../../dist/application/runtime/AdaptiveConsensusConfidenceEngine.js');

const strongFusion = {
  strategyId: 'fusion-reduzida',
  baseConfidenceScore: 0.86,
  riskScore: 0.22,
  evidenceScore: 86,
  allTime: {
    hitRatePercent: 64,
    roiPercent: 18,
    sampleSize: 80,
    maxConsecutiveLosses: 2,
  },
  last30Days: {
    hitRatePercent: 68,
    roiPercent: 20,
    sampleSize: 32,
    maxConsecutiveLosses: 2,
  },
  last7Days: {
    hitRatePercent: 72,
    roiPercent: 22,
    sampleSize: 12,
    maxConsecutiveLosses: 1,
  },
};

const strongTriplicacao = {
  strategyId: 'triplicacao',
  baseConfidenceScore: 0.84,
  riskScore: 0.24,
  evidenceScore: 84,
  allTime: {
    hitRatePercent: 62,
    roiPercent: 15,
    sampleSize: 75,
    maxConsecutiveLosses: 2,
  },
  last30Days: {
    hitRatePercent: 66,
    roiPercent: 18,
    sampleSize: 30,
    maxConsecutiveLosses: 2,
  },
  last7Days: {
    hitRatePercent: 70,
    roiPercent: 20,
    sampleSize: 12,
    maxConsecutiveLosses: 1,
  },
};

test('AdaptiveConsensusConfidenceEngine gera STRONG ou VERY_STRONG com duas estratégias performando bem', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const result = engine.evaluate([strongFusion, strongTriplicacao], {
    currentDrawdownPercent: 0,
    consensusRiskScore: 0.24,
  });

  assert.equal(result.paperEligible, true);
  assert.ok(['STRONG', 'VERY_STRONG'].includes(result.confidenceBand));
  assert.equal(result.acceptedStrategyIds.length, 2);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.blockers.length, 0);
});

test('AdaptiveConsensusConfidenceEngine penaliza performance recente fraca', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const weakRecent = {
    ...strongFusion,
    strategyId: 'fusion-fraca-recente',
    last7Days: {
      hitRatePercent: 35,
      roiPercent: -12,
      sampleSize: 10,
      maxConsecutiveLosses: 5,
    },
  };

  const result = engine.evaluate([weakRecent, strongTriplicacao], {
    currentDrawdownPercent: 0,
    consensusRiskScore: 0.3,
  });

  const weakAssessment = result.strategyAssessments.find((assessment) => assessment.strategyId === 'fusion-fraca-recente');

  assert.ok(weakAssessment);
  assert.ok(weakAssessment.decayPenaltyScore > 0);
  assert.ok(weakAssessment.warnings.includes('ADAPTIVE_RECENT_DECAY_ACTIVE'));
  assert.ok(result.finalConfidenceScore < 0.85);
});

test('AdaptiveConsensusConfidenceEngine ativa penalização por drawdown', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const result = engine.evaluate([strongFusion, strongTriplicacao], {
    currentDrawdownPercent: 5,
    consensusRiskScore: 0.3,
  });

  assert.ok(result.warnings.includes('ADAPTIVE_GLOBAL_DRAWDOWN_PROTECTION_ACTIVE'));
  assert.ok(result.strategyAssessments.every((assessment) => assessment.drawdownPenaltyScore > 0));
});

test('AdaptiveConsensusConfidenceEngine bloqueia quando há apenas uma estratégia aceita', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const blockedTriplicacao = {
    ...strongTriplicacao,
    blockers: ['TRIPLICACAO_BLOCKED'],
  };

  const result = engine.evaluate([strongFusion, blockedTriplicacao], {
    currentDrawdownPercent: 0,
    consensusRiskScore: 0.24,
  });

  assert.equal(result.paperEligible, false);
  assert.equal(result.acceptedStrategyIds.length, 1);
  assert.equal(result.blockers.includes('ADAPTIVE_REQUIRES_AT_LEAST_TWO_ACCEPTED_STRATEGIES'), true);
});

test('AdaptiveConsensusConfidenceEngine bloqueia confiança final baixa', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const weakA = {
    strategyId: 'weak-a',
    baseConfidenceScore: 0.45,
    riskScore: 0.35,
    evidenceScore: 40,
    allTime: {
      hitRatePercent: 42,
      roiPercent: -8,
      sampleSize: 40,
      maxConsecutiveLosses: 4,
    },
  };

  const weakB = {
    strategyId: 'weak-b',
    baseConfidenceScore: 0.46,
    riskScore: 0.36,
    evidenceScore: 42,
    allTime: {
      hitRatePercent: 43,
      roiPercent: -6,
      sampleSize: 40,
      maxConsecutiveLosses: 4,
    },
  };

  const result = engine.evaluate([weakA, weakB]);

  assert.equal(result.paperEligible, false);
  assert.ok(result.blockers.includes('ADAPTIVE_FINAL_CONFIDENCE_BELOW_PAPER_THRESHOLD'));
});

test('AdaptiveConsensusConfidenceEngine bloqueia risco final alto', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const result = engine.evaluate([
    {
      ...strongFusion,
      riskScore: 0.72,
    },
    {
      ...strongTriplicacao,
      riskScore: 0.73,
    },
  ], {
    consensusRiskScore: 0.72,
  });

  assert.equal(result.paperEligible, false);
  assert.ok(result.blockers.includes('ADAPTIVE_FINAL_RISK_ABOVE_PAPER_THRESHOLD'));
});

test('AdaptiveConsensusConfidenceEngine alerta amostra pequena', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const sampleLight = {
    strategyId: 'sample-light',
    baseConfidenceScore: 0.8,
    riskScore: 0.25,
    evidenceScore: 82,
    allTime: {
      hitRatePercent: 80,
      roiPercent: 20,
      sampleSize: 2,
      maxConsecutiveLosses: 0,
    },
  };

  const result = engine.evaluate([sampleLight, strongTriplicacao], {
    consensusRiskScore: 0.25,
  });

  const assessment = result.strategyAssessments.find((item) => item.strategyId === 'sample-light');

  assert.ok(assessment);
  assert.ok(assessment.sampleTrustScore < 35);
  assert.ok(assessment.warnings.includes('ADAPTIVE_SAMPLE_LOW_TRUST'));
});

test('AdaptiveConsensusConfidenceEngine mantém governança PAPER only', () => {
  const engine = new AdaptiveConsensusConfidenceEngine();

  const result = engine.evaluate([strongFusion, strongTriplicacao], {
    currentDrawdownPercent: 0,
    consensusRiskScore: 0,
  });

  assert.equal(result.paperOnly, true);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.operatorDecisionRequired, true);
  assert.equal(result.supervisedRecommendationOnly, true);
  assert.ok(result.hudSummary.includes('liveMoneyAuthorized=false'));
});
