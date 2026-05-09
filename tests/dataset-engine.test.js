const test = require('node:test');
const assert = require('node:assert/strict');
const { DatasetEngine } = require('../dist/domain/research/DatasetEngine');

test('DatasetEngine parses and normalizes CSV datasets with checksums', () => {
  const engine = new DatasetEngine();
  const csv = ['timestamp,value,tableId','2026-01-01T00:00:01Z,7,A','2026-01-01T00:00:02Z,12,A','2026-01-01T00:00:03Z,36,A'].join('\n');
  const parsed = engine.parse(csv);
  const normalized = engine.normalize(parsed.records);

  assert.equal(parsed.format, 'csv');
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.rejectedRows.length, 0);
  assert.equal(normalized.records.length, 3);
  assert.equal(normalized.records[0].sequence, 0);
  assert.equal(typeof normalized.records[0].checksum, 'string');
  assert.equal(normalized.checksum.length, 64);
  assert.deepEqual(normalized.metadata.tableIds, ['A']);
});

test('DatasetEngine rejects invalid spin values without throwing', () => {
  const engine = new DatasetEngine();
  const parsed = engine.parse('[0,1,36,37,-1,"x"]');

  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.rejectedRows.length, 3);
});
