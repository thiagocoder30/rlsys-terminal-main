const test = require('node:test');
const assert = require('node:assert');

const {
  SpatialClusterCorrelationEngine
} = require('../dist/domain/research/SpatialClusterCorrelationEngine');

function buildClusteredContext() {
  const records = [];

  for (let index = 0; index < 180; index += 1) {
    records.push({
      rouletteNumber: (index % 5) * 8,
      dealerId: 'dealer-alpha',
      regime: 'stable'
    });
  }

  for (let index = 0; index < 160; index += 1) {
    records.push({
      rouletteNumber: index % 37,
      dealerId: 'dealer-beta',
      regime: 'balanced'
    });
  }

  return records;
}

function buildBalancedContext() {
  const records = [];

  for (let index = 0; index < 240; index += 1) {
    records.push({
      rouletteNumber: index % 37,
      dealerId: 'dealer-balanced',
      regime: 'stable'
    });
  }

  return records;
}

test(
  'SpatialClusterCorrelationEngine detects contextual cluster correlation',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const result = engine.evaluate(buildClusteredContext());

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'CLUSTER_CORRELATION_CANDIDATE');
    assert.equal(result.value.strongestContext.contextKey, 'dealer-alpha|stable');
    assert.equal(result.value.strongestContext.dominantCluster, 0);
  }
);

test(
  'SpatialClusterCorrelationEngine reports weak or inconclusive balanced context',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const result = engine.evaluate(buildBalancedContext());

    assert.equal(result.ok, true);
    assert.notEqual(result.value.status, 'CLUSTER_CORRELATION_CANDIDATE');
  }
);

test(
  'SpatialClusterCorrelationEngine blocks insufficient samples',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const result = engine.evaluate([
      {
        rouletteNumber: 17,
        dealerId: 'dealer-small',
        regime: 'stable'
      }
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'BLOCKED');
    assert.equal(result.value.reason, 'INSUFFICIENT_SAMPLE');
  }
);

test(
  'SpatialClusterCorrelationEngine blocks oversized batches',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const records = [];

    for (let index = 0; index < 11; index += 1) {
      records.push({
        rouletteNumber: index % 37,
        dealerId: 'dealer-large',
        regime: 'stable'
      });
    }

    const result = engine.evaluate(records, {
      minSampleSize: 2,
      maxRecords: 10
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'BLOCKED');
    assert.equal(result.value.reason, 'MAX_RECORD_LIMIT_EXCEEDED');
  }
);

test(
  'SpatialClusterCorrelationEngine rejects malformed roulette numbers',
  () => {
    const engine = new SpatialClusterCorrelationEngine();
    const result = engine.evaluate([
      {
        rouletteNumber: 99,
        dealerId: 'dealer-bad',
        regime: 'stable'
      }
    ], {
      minSampleSize: 1
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'INVALID_ROULETTE_NUMBER');
  }
