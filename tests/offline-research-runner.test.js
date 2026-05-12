const test = require('node:test');
const assert = require('node:assert/strict');
const { OfflineResearchRunner } = require('../dist/domain/research/OfflineResearchRunner');

function commands(datasetId = 'offline-1', count = 18) {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: datasetId,
    value: index % 37,
    eventId: `${datasetId}-event-${index}`,
    sequence: index,
    occurredAt: `2026-05-12T04:00:${String(index % 60).padStart(2, '0')}.000Z`
  }));
}

test('OfflineResearchRunner processes clean datasets with deterministic checksum', () => {
  const runner = new OfflineResearchRunner();
  const request = {
    runtimeOptions: { warmupSize: 5, maxHistorySize: 20, decisionWindowSize: 5 },
    datasets: [
      { datasetId: 'dataset-a', label: 'balanced-a', commands: commands('dataset-a', 24) },
      { datasetId: 'dataset-b', label: 'balanced-b', commands: commands('dataset-b', 12) }
    ]
  };

  const first = runner.run(request);
  const second = runner.run(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.status, 'COMPLETED');
  assert.equal(first.value.datasetCount, 2);
  assert.equal(first.value.aggregate.totalFrames, 36);
  assert.equal(first.value.aggregate.acceptedEvents, 36);
  assert.equal(first.value.checksum, second.value.checksum);
});

test('OfflineResearchRunner preserves replay idempotency metrics for duplicate events', () => {
  const runner = new OfflineResearchRunner();
  const base = commands('dup-offline', 10);
  const result = runner.run({
    runtimeOptions: { warmupSize: 5, maxHistorySize: 20, decisionWindowSize: 5 },
    datasets: [{ datasetId: 'dup-offline', commands: [...base, base[0]] }]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.aggregate.acceptedEvents, 10);
  assert.equal(result.value.aggregate.duplicateEvents, 1);
  assert.equal(result.value.datasets[0].metrics.duplicateEvents, 1);
});

test('OfflineResearchRunner blocks oversized offline batches before replay', () => {
  const runner = new OfflineResearchRunner();
  const result = runner.run({
    maxTotalFrames: 5,
    datasets: [{ datasetId: 'too-large', commands: commands('too-large', 6) }]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'OFFLINE_RESEARCH_TOO_LARGE');
});

test('OfflineResearchRunner rejects malformed datasets without silent failure', () => {
  const runner = new OfflineResearchRunner();
  const result = runner.run({
    datasets: [
      { datasetId: 'same', commands: commands('same', 3) },
      { datasetId: 'same', commands: commands('same-2', 3) }
    ]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'OFFLINE_RESEARCH_INVALID_REQUEST');
});

test('OfflineResearchRunner reports no signal-like frames without treating it as failure', () => {
  const runner = new OfflineResearchRunner();
  const result = runner.run({
    runtimeOptions: { warmupSize: 50, maxHistorySize: 50, decisionWindowSize: 20 },
    datasets: [{ datasetId: 'observe-only', commands: commands('observe-only', 12) }]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'COMPLETED');
  assert.equal(result.value.datasets[0].metrics.signalLikeFrames, 0);
  assert.ok(result.value.datasets[0].warnings.some((warning) => warning.includes('no signal-like')));
});
