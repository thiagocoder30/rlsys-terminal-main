import test from 'node:test';
import assert from 'node:assert/strict';
import { MonteCarloResearchStudio } from '../dist/domain/research/MonteCarloResearchStudio.js';

const studio = new MonteCarloResearchStudio();

function profitableOutcomes(count = 80) {
  return Array.from({ length: count }, (_, index) => ({
    signalId: `signal-${index}`,
    stake: 1,
    netProfit: index % 5 === 0 ? -1 : 0.55,
    strategyId: 'sector-alpha',
    regime: 'STABLE',
    confidence: 0.78
  }));
}

function fragileOutcomes(count = 80) {
  return Array.from({ length: count }, (_, index) => ({
    signalId: `fragile-${index}`,
    stake: 1,
    netProfit: index % 3 === 0 ? -4 : 0.45,
    strategyId: 'fragile-alpha',
    regime: 'VOLATILE',
    confidence: 0.51
  }));
}

test('MonteCarloResearchStudio accepts robust candidate under variance stress', () => {
  const result = studio.run({
    experimentId: 'mc-robust',
    outcomes: profitableOutcomes(),
    startingBankroll: 100,
    seed: 42,
    policy: {
      simulationCount: 120,
      sequenceLength: 80,
      minOutcomes: 30,
      minSurvivalRate: 0.9,
      minMedianReturnRate: 0.02,
      maxP95DrawdownRate: 0.35,
      maxRuinRate: 0.08
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'ROBUST_UNDER_VARIANCE');
  assert.equal(result.value.metrics.simulationCount, 120);
  assert.ok(result.value.metrics.medianReturnRate > 0);
  assert.equal(result.value.blockers.length, 0);
});

test('MonteCarloResearchStudio blocks fragile candidate when drawdown and ruin risk are excessive', () => {
  const result = studio.run({
    experimentId: 'mc-fragile',
    outcomes: fragileOutcomes(),
    startingBankroll: 30,
    seed: 77,
    policy: { simulationCount: 100, sequenceLength: 100, maxP95DrawdownRate: 0.45, maxRuinRate: 0.1 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.blockers.length > 0);
});

test('MonteCarloResearchStudio is deterministic for the same seed and inputs', () => {
  const request = {
    experimentId: 'mc-deterministic',
    outcomes: profitableOutcomes(),
    startingBankroll: 100,
    seed: 101,
    policy: { simulationCount: 80, sequenceLength: 60 }
  };
  const first = studio.run(request);
  const second = studio.run(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.deepEqual(first.value.metrics, second.value.metrics);
});

test('MonteCarloResearchStudio blocks oversized research batches', () => {
  const result = studio.run({
    experimentId: 'mc-too-large',
    outcomes: profitableOutcomes(12),
    startingBankroll: 100,
    policy: { minOutcomes: 10, simulationCount: 50, sequenceLength: 50, maxSimulationCount: 10 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('maxSimulationCount')));
});

test('MonteCarloResearchStudio rejects malformed outcomes without silent failure', () => {
  const result = studio.run({
    experimentId: 'mc-invalid',
    outcomes: [{ signalId: '', stake: -1, netProfit: Number.NaN }],
    startingBankroll: 100
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MONTE_CARLO_RESEARCH_INVALID_REQUEST');
});

