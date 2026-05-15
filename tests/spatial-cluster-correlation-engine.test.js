const test = require('node:test');
const assert = require('node:assert');

const {
  SpatialClusterCorrelationEngine
} = require('../dist/domain/research/SpatialClusterCorrelationEngine');

function buildCorrelatedDataset() {
  const records = [];
  const dominantNumbers = [0, 32, 15, 19, 4];
  const fillerNumbers = [21, 2, 25, 17, 34, 6, 27, 13, 36, 11];

  for (let index = 0; index < 120; index += 1) {
    records.push({
      eventId: `alpha-${index}`,
      dealerId: 'dealer-alpha',
      regime: 'stable',
      rouletteNumber: dominantNumbers[index % dominantNumbers.length]
    });
  }

  for (let index = 0; index < 180; index += 1) {
    records.push({
      eventId: `baseline-${index}`,
      dealerId: 'dealer-beta',
      regime: 'balanced',
      rouletteNumber: fillerNumbers[index % fillerNumbers.length]
    });
  }

  return records;
}

function buildBalancedDataset() {
  const records = [];

  for (let index = 0; index < 160; index += 1) {
    records.push({
      eventId: `balanced-a-${index}`,
      dealerId: 'dealer-a',
      regime: 'balanced',
      rouletteNumber: index % 37
    });
  }

  for (let index = 0; index < 160; index += 1) {
    records.push({
      eventId: `balanced-b-${index}`,
      dealerId: 'dealer-b',
      regime: 'balanced',
      rouletteNumber: (index + 11) % 37
    });
  }

  return records;
}

test('SpatialClusterCorrelationEngine detects contextual spatial cluster', () => {
  const engine = new SpatialClusterCorrelationEngine();

  const result = engine.evaluate(buildCorrelatedDataset());

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'CLUSTER_CORRELATION_CANDIDATE');
  assert.ok(result.value.dominantContext);
  assert.equal(result.value.dominantContext.contextKey, 'dealer:dealer-alpha|regime:stable');
  assert.ok(result.value.dominantContext.lift >= 1.75);
  assert.match(result.value.checksum, /^scc-[0-9a-f]{8}$/);
});

test('SpatialClusterCorrelationEngine remains deterministic for repeated evaluation', () => {
  const engine = new SpatialClusterCorrelationEngine();
  const records = buildCorrelatedDataset();

  const first = engine.evaluate(records);
  const second = engine.evaluate(records);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.deepEqual(first.value, second.value);
});

test('SpatialClusterCorrelationEngine returns inconclusive for balanced contexts', () => {
  const engine = new SpatialClusterCorrelationEngine();

  const result = engine.evaluate(buildBalancedDataset(), {
    minLiftForCandidate: 2.4,
    minLiftForWeakCorrelation: 2.0
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'INCONCLUSIVE');
});

test('SpatialClusterCorrelationEngine blocks insufficient sample', () => {
  const engine = new SpatialClusterCorrelationEngine();

  const result = engine.evaluate([
    {
      eventId: 'tiny-1',
      dealerId: 'dealer-small',
      regime: 'stable',
      rouletteNumber: 17
    }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.reason, 'INSUFFICIENT_SAMPLE');
});

test('SpatialClusterCorrelationEngine rejects malformed roulette values without silent failure', () => {
  const engine = new SpatialClusterCorrelationEngine();
  const records = [];

  for (let index = 0; index < 90; index += 1) {
    records.push({
      eventId: `invalid-${index}`,
      dealerId: 'dealer-invalid',
      regime: 'stable',
      rouletteNumber: index === 50 ? 99 : index % 37
    });
  }

  const result = engine.evaluate(records);

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_ROULETTE_NUMBER');
});
