const test = require('node:test');
const assert = require('node:assert');
const { BoundedSpinBuffer } = require('../../dist/domain/research/BoundedSpinBuffer');
const { MultiDealerAggregator } = require('../../dist/domain/research/MultiDealerAggregator');

test('BoundedSpinBuffer: Limita o tamanho e subscreve dados antigos (O(1) Insertion)', () => {
  const buffer = new BoundedSpinBuffer(3);
  
  buffer.push({ dealerId: 'D1', wheelSpeed: 'NORMAL', result: 1 });
  buffer.push({ dealerId: 'D1', wheelSpeed: 'NORMAL', result: 2 });
  buffer.push({ dealerId: 'D1', wheelSpeed: 'NORMAL', result: 3 });
  assert.strictEqual(buffer.length, 3);
  
  // A rodada 4 deve expulsar a rodada 1
  buffer.push({ dealerId: 'D1', wheelSpeed: 'NORMAL', result: 4 });
  
  const arr = buffer.toArray();
  assert.strictEqual(arr.length, 3);
  assert.strictEqual(arr[0].result, 2); // Rodada 1 sumiu
  assert.strictEqual(arr[2].result, 4); // Nova rodada no fim
});

test('MultiDealerAggregator: Roteia rodadas para os buffers corretos', () => {
  const aggregator = new MultiDealerAggregator({ maxActiveDealers: 5, maxSpinsPerDealer: 100 });
  
  aggregator.ingestSpin({ dealerId: 'ALICE', wheelSpeed: 'NORMAL', result: 10 });
  aggregator.ingestSpin({ dealerId: 'BOB', wheelSpeed: 'FAST', result: 5 });
  aggregator.ingestSpin({ dealerId: 'ALICE', wheelSpeed: 'NORMAL', result: 15 });
  
  assert.strictEqual(aggregator.getSpinCount('ALICE'), 2);
  assert.strictEqual(aggregator.getSpinCount('BOB'), 1);
  assert.strictEqual(aggregator.getDealerCount(), 2);
});

test('MultiDealerAggregator: Protege a memória rejeitando novos dealers além do limite', () => {
  const aggregator = new MultiDealerAggregator({ maxActiveDealers: 2, maxSpinsPerDealer: 10 });
  
  aggregator.ingestSpin({ dealerId: 'D1', wheelSpeed: 'NORMAL', result: 1 });
  aggregator.ingestSpin({ dealerId: 'D2', wheelSpeed: 'NORMAL', result: 2 });
  
  const result = aggregator.ingestSpin({ dealerId: 'D3', wheelSpeed: 'NORMAL', result: 3 });
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'MAX_ACTIVE_DEALERS_REACHED');
  assert.strictEqual(aggregator.getDealerCount(), 2);
});
