const test = require('node:test');
const assert = require('node:assert/strict');
const { DatasetRegistryEngine } = require('../dist/domain/datasets/DatasetRegistryEngine');

function values(count = 120) {
  return Array.from({ length: count }, (_, index) => index % 37);
}

function cleanDataset(id = 'dataset-clean') {
  return {
    datasetId: id,
    sourceType: 'CSV',
    provider: 'Evolution',
    tableId: 'auto-roulette-1',
    dealerId: 'dealer-a',
    capturedAt: '2026-05-12T10:00:00.000Z',
    roundCount: 120,
    sampleValues: values(120),
    tags: ['stable', 'european', 'stable'],
    regimeLabel: 'STABLE',
    reliabilityScore: 0.98,
    completenessScore: 1
  };
}

test('DatasetRegistryEngine accepts high quality datasets with deterministic checksums', () => {
  const engine = new DatasetRegistryEngine();
  const request = {
    registryId: 'registry-alpha',
    datasets: [cleanDataset('dataset-a'), cleanDataset('dataset-b')]
  };

  const first = engine.register(request);
  const second = engine.register(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.status, 'ACCEPTED');
  assert.equal(first.value.summary.acceptedDatasets, 2);
  assert.equal(first.value.summary.uniqueProviders, 1);
  assert.equal(first.value.records[0].qualityGrade, 'A');
  assert.deepEqual(first.value.records[0].tags, ['european', 'stable']);
  assert.equal(first.value.checksum, second.value.checksum);
});

test('DatasetRegistryEngine requires review for OCR datasets with weak reliability', () => {
  const engine = new DatasetRegistryEngine();
  const result = engine.register({
    registryId: 'ocr-review',
    datasets: [{
      ...cleanDataset('ocr-low-confidence'),
      sourceType: 'OCR',
      reliabilityScore: 0.74,
      completenessScore: 0.95,
      tags: ['ocr', 'needs-review']
    }]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REVIEW_REQUIRED');
  assert.equal(result.value.records[0].requiresReview, true);
  assert.ok(result.value.records[0].warnings.some((warning) => warning.includes('reliability')));
});

test('DatasetRegistryEngine blocks corrupted roulette sample values', () => {
  const engine = new DatasetRegistryEngine();
  const result = engine.register({
    registryId: 'corrupted-values',
    datasets: [{ ...cleanDataset('bad-values'), sampleValues: [0, 1, 37], roundCount: 3 }]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('between 0 and 36')));
});

test('DatasetRegistryEngine rejects duplicate dataset ids without silent failure', () => {
  const engine = new DatasetRegistryEngine();
  const result = engine.register({
    registryId: 'duplicate-registry',
    datasets: [cleanDataset('same'), cleanDataset('same')]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'DATASET_REGISTRY_INVALID_REQUEST');
});

test('DatasetRegistryEngine blocks oversized dataset batches before processing', () => {
  const engine = new DatasetRegistryEngine();
  const result = engine.register({
    registryId: 'too-many',
    policy: { maxDatasets: 1 },
    datasets: [cleanDataset('a'), cleanDataset('b')]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'DATASET_REGISTRY_TOO_LARGE');
});

test('DatasetRegistryEngine can block synthetic datasets by policy', () => {
  const engine = new DatasetRegistryEngine();
  const result = engine.register({
    registryId: 'synthetic-block',
    policy: { blockSynthetic: true },
    datasets: [{ ...cleanDataset('synthetic-a'), sourceType: 'SYNTHETIC', tags: ['synthetic', 'control'] }]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.ok(result.value.records[0].blockers.some((blocker) => blocker.includes('synthetic')));
});
