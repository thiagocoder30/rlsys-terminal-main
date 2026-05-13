const test = require('node:test');
const assert = require('node:assert');

const {
  DealerSignatureEngine
} = require('../dist/domain/research/DealerSignatureEngine');

function clusteredDealerRecords() {
  const sectorNumbers = [0, 32, 15, 19, 4, 21, 2, 25];
  const neutralNumbers = [10, 5, 24, 16, 33, 1, 20, 14];
  const records = [];

  for (let index = 0; index < 180; index += 1) {
    records.push({
      dealerId: 'dealer-alpha',
      rouletteNumber: sectorNumbers[index % sectorNumbers.length],
      sequenceIndex: index
    });
  }

  for (let index = 0; index < 60; index += 1) {
    records.push({
      dealerId: 'dealer-alpha',
      rouletteNumber: neutralNumbers[index % neutralNumbers.length],
      sequenceIndex: index + 180
    });
  }

  return records;
}

function balancedDealerRecords() {
  const wheel = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13,
    36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
    14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  const records = [];

  for (let index = 0; index < 240; index += 1) {
    records.push({
      dealerId: 'dealer-beta',
      rouletteNumber: wheel[index % wheel.length],
      sequenceIndex: index
    });
  }

  return records;
}

test('DealerSignatureEngine detects persistent dealer sector signature', () => {
  const engine = new DealerSignatureEngine();
  const result = engine.evaluate(clusteredDealerRecords(), 'dealer-alpha');

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'SIGNATURE_CANDIDATE');
  assert.equal(result.value.dominantSectorId, 0);
  assert.ok(result.value.dominantSectorRatio >= 0.38);
  assert.ok(result.value.deviationFromBaseline > 0);
  assert.equal(result.value.blockers.length, 0);
});

test('DealerSignatureEngine returns inconclusive for balanced dealer history', () => {
  const engine = new DealerSignatureEngine();
  const result = engine.evaluate(balancedDealerRecords(), 'dealer-beta');

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'INCONCLUSIVE');
  assert.ok(result.value.warnings.length > 0);
});

test('DealerSignatureEngine blocks insufficient dealer sample', () => {
  const engine = new DealerSignatureEngine();
  const result = engine.evaluate([
    {
      dealerId: 'dealer-gamma',
      rouletteNumber: 17,
      sequenceIndex: 0
    }
  ], 'dealer-gamma');

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.deepEqual(result.value.blockers, ['INSUFFICIENT_SAMPLE']);
});

test('DealerSignatureEngine rejects malformed roulette values without silent failure', () => {
  const engine = new DealerSignatureEngine();
  const records = clusteredDealerRecords().concat([
    {
      dealerId: 'dealer-alpha',
      rouletteNumber: 99,
      sequenceIndex: 999
    }
  ]);

  const result = engine.evaluate(records, 'dealer-alpha');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_ROULETTE_NUMBER');
});

test('DealerSignatureEngine blocks oversized batches for low-end hardware safety', () => {
  const engine = new DealerSignatureEngine({
    maxRecords: 2
  });

  const result = engine.evaluate(clusteredDealerRecords(), 'dealer-alpha');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'RECORD_BATCH_TOO_LARGE');
});

test('DealerSignatureEngine is deterministic for repeated analysis', () => {
  const engine = new DealerSignatureEngine();
  const records = clusteredDealerRecords();

  const first = engine.evaluate(records, 'dealer-alpha');
  const second = engine.evaluate(records, 'dealer-alpha');

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.checksum, second.value.checksum);
});
