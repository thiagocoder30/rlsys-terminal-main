const test = require('node:test');
const assert = require('node:assert/strict');
const { ResearchExperimentOrchestrator } = require('../dist/domain/research/ResearchExperimentOrchestrator');

function registryReport(overrides = {}) {
  return {
    engineVersion: 'dataset-registry-engine-v1',
    registryId: 'registry-alpha',
    status: 'ACCEPTED',
    records: [],
    summary: {
      totalDatasets: 2,
      acceptedDatasets: 2,
      reviewDatasets: 0,
      blockedDatasets: 0,
      totalRounds: 240,
      averageReliabilityScore: 0.95,
      averageCompletenessScore: 0.98,
      uniqueProviders: 1,
      uniqueTables: 1,
      uniqueDealers: 1,
      tagCount: 3
    },
    blockers: [],
    warnings: [],
    checksum: 'registry-checksum',
    ...overrides
  };
}

function offlineReport(overrides = {}) {
  return {
    engineVersion: 'offline-research-runner-v1',
    status: 'COMPLETED',
    datasetCount: 2,
    processedDatasets: 2,
    aggregate: {
      totalFrames: 240,
      acceptedEvents: 240,
      duplicateEvents: 0,
      rejectedEvents: 0,
      blockedDatasets: 0,
      weightedReadyFrameRate: 0.84,
      weightedSignalLikeRate: 0.12,
      weightedAverageEntropy: 0.91,
      weightedAverageRepeatRate: 0.08,
      weightedAverageConcentration: 0.1
    },
    datasets: [],
    blockers: [],
    warnings: [],
    checksum: 'offline-checksum',
    ...overrides
  };
}

function analyticsReport(overrides = {}) {
  return {
    engineVersion: 'ev-risk-analytics-engine-v1',
    status: 'POSITIVE_EDGE_CANDIDATE',
    experimentId: 'alpha-experiment',
    metrics: {
      sampleSize: 64,
      totalStake: 64,
      totalNetProfit: 9,
      expectedValuePerSignal: 0.140625,
      expectedValuePerUnitStake: 0.140625,
      winRate: 0.68,
      lossRate: 0.32,
      averageWin: 0.5,
      averageLoss: 1,
      profitFactor: 1.32,
      maxDrawdown: 4,
      maxDrawdownRate: 0.04,
      startingBankroll: 100,
      endingBankroll: 109,
      minEquity: 96,
      ruinEvents: 0,
      riskOfRuinEstimate: 0,
      signalFrequency: 0.266667,
      averageConfidence: 0.74
    },
    strategyBreakdown: [],
    regimeBreakdown: [],
    blockers: [],
    warnings: [],
    checksum: 'analytics-checksum',
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    experimentId: 'exp-alpha-001',
    hypothesis: 'Dealer-specific sector pressure creates measurable positive EV.',
    registryReport: registryReport(),
    offlineReport: offlineReport(),
    analyticsReport: analyticsReport(),
    policy: { minAcceptedDatasets: 2, minTotalFrames: 120, minSignalFrequency: 0.01 },
    ...overrides
  };
}

test('ResearchExperimentOrchestrator promotes governed positive edge to alpha candidate', () => {
  const orchestrator = new ResearchExperimentOrchestrator();
  const result = orchestrator.orchestrate(request());

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'ALPHA_CANDIDATE');
  assert.equal(result.value.stages.length, 3);
  assert.equal(result.value.summary.acceptedDatasets, 2);
  assert.ok(result.value.conclusion.includes('Alpha candidate'));
  assert.deepEqual(result.value.evidenceChecksums, ['registry-checksum', 'offline-checksum', 'analytics-checksum']);
});

test('ResearchExperimentOrchestrator blocks when analytics is negative or inconclusive', () => {
  const orchestrator = new ResearchExperimentOrchestrator();
  const result = orchestrator.orchestrate(
    request({
      analyticsReport: analyticsReport({
        status: 'NEGATIVE_OR_INCONCLUSIVE',
        blockers: ['EV/unit -0.020000 below minimum 0.010000']
      })
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('analytics did not confirm')));
  assert.ok(result.value.conclusion.includes('Experiment blocked'));
});

test('ResearchExperimentOrchestrator blocks mismatched dataset counts without silent failure', () => {
  const orchestrator = new ResearchExperimentOrchestrator();
  const result = orchestrator.orchestrate(
    request({
      offlineReport: offlineReport({ datasetCount: 3 })
    })
  );

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'RESEARCH_EXPERIMENT_INVALID_REQUEST');
});

test('ResearchExperimentOrchestrator is deterministic for repeated experiment envelopes', () => {
  const orchestrator = new ResearchExperimentOrchestrator();
  const first = orchestrator.orchestrate(request());
  const second = orchestrator.orchestrate(request());

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.checksum, second.value.checksum);
});

test('ResearchExperimentOrchestrator blocks insufficient offline frame evidence', () => {
  const orchestrator = new ResearchExperimentOrchestrator();
  const result = orchestrator.orchestrate(
    request({
      offlineReport: offlineReport({
        aggregate: { ...offlineReport().aggregate, totalFrames: 20 }
      }),
      policy: { minAcceptedDatasets: 2, minTotalFrames: 120, minSignalFrequency: 0.01 }
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('total frames')));
});

