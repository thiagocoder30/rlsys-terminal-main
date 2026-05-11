const test = require('node:test');
const assert = require('node:assert/strict');
const { AdaptiveConfidenceEngine } = require('../dist/domain/confidence/AdaptiveConfidenceEngine');

function strongInput(overrides = {}) {
  return {
    baseConfidence: 0.86,
    evidenceScore: 0.82,
    regimeConfidence: 0.88,
    ensembleConsensusScore: 0.84,
    temporalFreshnessWeight: 0.9,
    dataQualityScore: 0.96,
    riskPenalty: 0.16,
    noisePenalty: 0.12,
    sampleSize: 240,
    ...overrides
  };
}

test('AdaptiveConfidenceEngine allows mature low-noise signal calibration', () => {
  const result = new AdaptiveConfidenceEngine().calibrate(strongInput());

  assert.equal(result.success, true);
  assert.equal(result.value.engineVersion, 'adaptive-confidence-v1');
  assert.equal(result.value.decision, 'ALLOW');
  assert.ok(result.value.normalizedConfidence >= result.value.adaptiveThreshold);
  assert.ok(['A', 'B'].includes(result.value.grade));
  assert.equal(result.value.blockers.length, 0);
  assert.equal(result.value.components.length, 7);
});

test('AdaptiveConfidenceEngine observes marginal confidence near dynamic threshold', () => {
  const result = new AdaptiveConfidenceEngine().calibrate(strongInput({
    baseConfidence: 0.78,
    evidenceScore: 0.74,
    regimeConfidence: 0.74,
    ensembleConsensusScore: 0.7,
    temporalFreshnessWeight: 0.68,
    dataQualityScore: 0.84,
    riskPenalty: 0.3,
    noisePenalty: 0.34,
    sampleSize: 120
  }));

  assert.equal(result.success, true);
  assert.equal(result.value.decision, 'OBSERVE');
  assert.ok(result.value.warnings.some((warning) => warning.includes('threshold adaptativo')));
  assert.equal(result.value.blockers.length, 0);
});

test('AdaptiveConfidenceEngine blocks noisy low-quality calibration', () => {
  const result = new AdaptiveConfidenceEngine().calibrate(strongInput({
    dataQualityScore: 0.3,
    noisePenalty: 0.9,
    sampleSize: 40,
    baseConfidence: 0.52,
    evidenceScore: 0.48
  }));

  assert.equal(result.success, true);
  assert.equal(result.value.decision, 'BLOCK_LOW_CONFIDENCE');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('Qualidade de dados')));
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('Ruído operacional')));
});

test('AdaptiveConfidenceEngine rejects malformed input without silent failure', () => {
  const result = new AdaptiveConfidenceEngine().calibrate(strongInput({ baseConfidence: 1.4 }));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ADAPTIVE_CONFIDENCE_FAILED');
  assert.match(result.error.message, /invalid_adaptive_base_confidence/);
});
