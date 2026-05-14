const test = require('node:test');
const assert = require('node:assert');

const {
  SpatialClusterCorrelationEngine
} = require('../dist/domain/research/SpatialClusterCorrelationEngine');

const WHEEL_CLUSTER_ZERO_NUMBERS = [0, 32, 15, 19, 4];

function buildDealerClusterDataset() {
  const records = [];

  for (let index = 0; index < 120; index += 1) {
    records.push({
      rouletteNumber: WHEEL_CLUSTER_ZERO_NUMBERS[index % WHEEL_CLUSTER_ZERO_NUMBERS.length],
      dealerId: 'dealer-alpha',
      regime: 'stable'
    });
  }

  for (let index = 0; index < 80; index += 1) {
    records.push({
      rouletteNumber: index % 37,
      dealerId: 'dealer-beta',
      regime: 'balanced'
    });
  }

  return records;
}

function buildBalancedDataset() {
  const records = [];

  for (let index = 0; index < 240; index += 1) {
    records.push({
      rouletteNumber: index % 37,
      dealerId: 'dealer-balanced',
      regime: 'balanced'
    });
  }

  return records;
}

test(
  'SpatialClusterCorrelationEngine detects dealer-linked spatial cluster candidate',
  () => {
    const engine = new SpatialClusterCorrelationEngine();

    const result = engine.analyze(
      buildDealerClusterDataset(),
      'DEALER',
      {
        minSampleSize: 100,
        clusterSize: 5,
        candidateRatioThreshold: 0.55,
        weakRatioThreshold: 0.35
      }
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.value.status,
      'CLUSTER_CORRELATION_CANDIDATE'
    );
    assert.equal(
      result.value.dominantContextKey,
      'dealer-alpha'
    );
    assert.equal(
      result.value.dominantClusterId,
      0
    );
  }
);

test(
  'SpatialClusterCorrelationEngine returns inconclusive for balanced spatial history',
  () => {
    const engine = new SpatialClusterCorrelationEngine();

    const result = engine.analyze(
      buildBalancedDataset(),
      'GLOBAL',
      {
        minSampleSize: 100,
        clusterSize: 5,
        candidateRatioThreshold: 0.45,
        weakRatioThreshold: 0.32
      }
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.value.status,
      'INCONCLUSIVE'
    );
  }
);

test(
  'SpatialClusterCorrelationEngine blocks insufficient samples',
  () => {
    const engine = new SpatialClusterCorrelationEngine();

    const result = engine.analyze(
      [
        {
          rouletteNumber: 17,
          dealerId: 'dealer-small',
          regime: 'stable'
        }
      ],
      'DEALER'
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.value.status,
      'BLOCKED'
    );
    assert.equal(
      result.value.reason,
      'INSUFFICIENT_SAMPLE'
    );
  }
);

test(
  'SpatialClusterCorrelationEngine blocks oversized research batches',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const records = buildBalancedDataset();

    const result = engine.analyze(
      records,
      'GLOBAL',
      {
        maxRecords: 10
      }
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.value.status,
      'BLOCKED'
    );
    assert.equal(
      result.value.reason,
      'BATCH_TOO_LARGE'
    );
  }
);

test(
  'SpatialClusterCorrelationEngine rejects malformed roulette numbers without silent failure',
  () => {
    const engine = new SpatialClusterCorrelationEngine();

    const result = engine.analyze(
      [
        {
          rouletteNumber: 99,
          dealerId: 'dealer-invalid',
          regime: 'stable'
        },
        ...buildBalancedDataset()
      ],
      'DEALER'
