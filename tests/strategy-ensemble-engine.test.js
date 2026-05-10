const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyEnsembleEngine } = require('../dist/domain/strategy/StrategyEnsembleEngine');

function supportVote(strategyId, targetId = 'sector-voisins', confidence = 0.82, evidenceScore = 0.78, riskPenalty = 0.18) {
  return {
    strategyId,
    label: `Strategy ${strategyId}`,
    status: 'SUPPORT',
    targetId,
    targetLabel: 'Voisins Sector',
    confidence,
    evidenceScore,
    riskPenalty,
    recencyWeight: 0.94,
    weight: 0.8
  };
}

test('StrategyEnsembleEngine forms consensus from aligned strategy votes', () => {
  const result = new StrategyEnsembleEngine().evaluate([
    supportVote('alpha'),
    supportVote('beta', 'sector-voisins', 0.76, 0.74, 0.2),
    {
      ...supportVote('gamma'),
      status: 'ABSTAIN',
      weight: 0.3
    }
  ]);

  assert.equal(result.success, true);
  const report = result.value;
  assert.equal(report.engineVersion, 'strategy-ensemble-v1');
  assert.equal(report.decision, 'CONSENSUS');
  assert.equal(report.selectedTarget.targetId, 'sector-voisins');
  assert.equal(report.selectedTarget.supportVotes, 2);
  assert.equal(report.selectedTarget.opposeVotes, 0);
  assert.ok(report.selectedTarget.consensusScore >= 0.58);
  assert.ok(report.warnings.some((warning) => warning.includes('abstenção')));
});

test('StrategyEnsembleEngine blocks when strategies conflict above policy limit', () => {
  const result = new StrategyEnsembleEngine().evaluate([
    supportVote('alpha'),
    supportVote('beta'),
    {
      ...supportVote('delta'),
      status: 'OPPOSE',
      confidence: 0.8,
      evidenceScore: 0.7,
      weight: 0.95
    },
    {
      ...supportVote('epsilon'),
      status: 'OPPOSE',
      confidence: 0.78,
      evidenceScore: 0.69,
      weight: 0.85
    }
  ]);

  assert.equal(result.success, true);
  assert.equal(result.value.decision, 'CONFLICT');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('Conflito')));
  assert.ok(result.value.selectedTarget.conflictScore > 0.42);
});

test('StrategyEnsembleEngine rejects malformed votes without silent failure', () => {
  const result = new StrategyEnsembleEngine().evaluate([
    {
      ...supportVote('alpha'),
      confidence: 1.5
    }
  ]);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'STRATEGY_ENSEMBLE_FAILED');
  assert.match(result.error.message, /invalid_ensemble_vote_confidence/);
});
