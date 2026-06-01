import test from 'node:test';
import assert from 'node:assert/strict';
import { WarmupUploadIngestionEngine } from '../dist/domain/warmup-upload-ingestion/index.js';

const createPolicy = () => ({
  requiredWarmupSize: 200,
  minimumRouletteNumber: 0,
  maximumRouletteNumber: 36,
});

test('WarmupUploadIngestionEngine accepts JSON array with 200 roulette rounds', () => {
  const values = Array.from({ length: 200 }, (_, index) => index % 37);

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'upload-json',
    payload: JSON.stringify(values),
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'WARMUP_UPLOAD_ACCEPTED');
    assert.equal(result.value.values.length, 200);
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('WarmupUploadIngestionEngine keeps last 200 rounds when upload has more than required size', () => {
  const values = Array.from({ length: 220 }, (_, index) => index % 37);

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'upload-json',
    payload: JSON.stringify({ values }),
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.values.length, 200);
    assert.equal(result.value.values[0], values[20]);
    assert.equal(result.value.metrics.discardedRounds, 20);
  }
});

test('WarmupUploadIngestionEngine returns AGUARDAR when fewer than 200 valid rounds are available', () => {
  const values = Array.from({ length: 100 }, (_, index) => index % 37);

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'manual-text',
    payload: values.join(' '),
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'WARMUP_UPLOAD_NEEDS_MORE_ROUNDS');
    assert.equal(result.value.values.length, 100);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('WarmupUploadIngestionEngine returns Result/Either error on invalid payload', () => {
  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'bad-upload',
    payload: 'red black zero',
    policy: createPolicy(),
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_WARMUP_UPLOAD_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
    assert.equal(result.error.activeSessionMutationAllowed, false);
  }
});

test('WarmupUploadIngestionEngine filters invalid roulette numbers without opening risk', () => {
  const valid = Array.from({ length: 200 }, (_, index) => index % 37);
  const values = [-1, 99, ...valid];

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'mixed-upload',
    payload: JSON.stringify({ rounds: values }),
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.values.length, 200);
    assert.equal(result.value.metrics.discardedRounds, 2);
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('WarmupUploadIngestionEngine processes large copied OCR text in linear behavior', () => {
  const values = Array.from({ length: 1000 }, (_, index) => index % 37);

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: 'ocr-text-fallback',
    payload: values.join(', '),
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.values.length, 200);
    assert.equal(result.value.metrics.extractedRounds, 1000);
    assert.equal(result.value.metrics.discardedRounds, 800);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});
