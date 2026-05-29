'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WarmupSessionBootstrapEngine } = require('../../../src/domain/warmup/WarmupSessionBootstrapEngine');
const { WarmupIntegrityValidator } = require('../../../src/domain/warmup/WarmupIntegrityValidator');
const { WarmupQualificationEngine } = require('../../../src/domain/warmup/WarmupQualificationEngine');

function createInstitutionalWarmup(size) {
  const numbers = [];

  for (let index = 0; index < size; index += 1) {
    numbers.push(index % 37);
  }

  const bootstrap = new WarmupSessionBootstrapEngine({
    allowedWarmupSizes: [size],
    minConfidence: 0.8
  });

  const bootstrapped = bootstrap.bootstrap({
    source: 'MANUAL_IMPORT',
    numbers,
    confidence: 0.97
  });

  assert.equal(bootstrapped.ok, true);

  const validator = new WarmupIntegrityValidator({
    allowedWarmupSizes: [size],
    minConfidence: 0.8
  });

  const integrityReport = validator.validate(bootstrapped.value);
  assert.equal(integrityReport.valid, true);

  return {
    warmupState: bootstrapped.value,
    integrityReport
  };
}

test('approves a qualified warmup but keeps all gates blocked', () => {
  const input = createInstitutionalWarmup(100);
  const engine = new WarmupQualificationEngine();

  const decision = engine.qualify(input);

  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.approved, true);
  assert.equal(decision.operationalGate, 'BLOCKED');
  assert.equal(decision.paperGate, 'BLOCKED');
  assert.equal(decision.liveGate, 'BLOCKED');
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.ok(decision.qualificationScore >= 0.74);
});

test('rejects when integrity report is invalid', () => {
  const input = createInstitutionalWarmup(20);
  const engine = new WarmupQualificationEngine();

  const decision = engine.qualify({
    warmupState: input.warmupState,
    integrityReport: {
      ...input.integrityReport,
      status: 'INVALID',
      valid: false,
      reasons: ['forced_invalid']
    }
  });

  assert.equal(decision.status, 'REJECTED');
  assert.equal(decision.approved, false);
  assert.ok(decision.reasons.includes('integrity_report_invalid'));
});

test('rejects invariant violation for live money', () => {
  const input = createInstitutionalWarmup(20);
  const engine = new WarmupQualificationEngine();

  const decision = engine.qualify({
    warmupState: {
      ...input.warmupState,
      liveMoneyAuthorized: true
    },
    integrityReport: input.integrityReport
  });

  assert.equal(decision.status, 'REJECTED');
  assert.ok(decision.reasons.includes('live_money_invariant_violation'));
  assert.equal(decision.liveMoneyAuthorized, false);
});

test('rejects weak unique coverage', () => {
  const engine = new WarmupQualificationEngine({
    minUniqueCoverageRatio: 0.8,
    minQualificationScore: 0.1
  });

  const decision = engine.qualify({
    warmupState: {
      sessionId: 'warmup-low-diversity',
      roundsLoaded: 20,
      confidence: 0.99,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    },
    integrityReport: {
      status: 'VALID',
      valid: true,
      uniqueNumbers: 5,
      singleNumberDominanceRatio: 0.15
    }
  });

  assert.equal(decision.status, 'REJECTED');
  assert.ok(decision.reasons.includes('unique_coverage_below_minimum'));
});

test('rejects excessive dominance', () => {
  const engine = new WarmupQualificationEngine({
    maxSingleNumberDominanceRatio: 0.2,
    minQualificationScore: 0.1
  });

  const decision = engine.qualify({
    warmupState: {
      sessionId: 'warmup-dominance',
      roundsLoaded: 100,
      confidence: 0.99,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    },
    integrityReport: {
      status: 'VALID',
      valid: true,
      uniqueNumbers: 30,
      singleNumberDominanceRatio: 0.4
    }
  });

  assert.equal(decision.status, 'REJECTED');
  assert.ok(decision.reasons.includes('dominance_above_qualification_limit'));
});

test('is deterministic and idempotent', () => {
  const input = createInstitutionalWarmup(30);
  const engine = new WarmupQualificationEngine();

  const first = engine.qualify(input);
  const second = engine.qualify(input);

  assert.deepEqual(first, second);
});

test('rejects missing input safely', () => {
  const engine = new WarmupQualificationEngine();

  const decision = engine.qualify(null);

  assert.equal(decision.status, 'REJECTED');
  assert.ok(decision.reasons.includes('input_not_object'));
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new WarmupQualificationEngine({ minQualificationScore: 2 }),
    /minQualificationScore/
  );

  assert.throws(
    () => new WarmupQualificationEngine({ minConfidence: -1 }),
    /minConfidence/
  );

  assert.throws(
    () => new WarmupQualificationEngine({ maxSingleNumberDominanceRatio: 0 }),
    /maxSingleNumberDominanceRatio/
  );
});
