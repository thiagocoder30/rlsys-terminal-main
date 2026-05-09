const test = require('node:test');
const assert = require('node:assert/strict');
const { BootstrapResampler } = require('../dist/domain/simulation/BootstrapResampler');

function balancedHistory(size = 180) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

test('BootstrapResampler creates deterministic block samples with checksums', () => {
  const resampler = new BootstrapResampler();
  const history = balancedHistory(160);
  const a = resampler.sample(history, 7, { seed: 'deterministic', blockSize: 8 });
  const b = resampler.sample(history, 7, { seed: 'deterministic', blockSize: 8 });

  assert.equal(a.values.length, history.length);
  assert.equal(a.checksum, b.checksum);
  assert.equal(a.blockSize, 8);
  assert.ok(a.replacementRatio >= 0 && a.replacementRatio <= 1);
});

test('BootstrapResampler rejects insufficient history', () => {
  const resampler = new BootstrapResampler();
  assert.throws(() => resampler.sample([1, 2, 3], 0), /insufficient_bootstrap_history/);
});
