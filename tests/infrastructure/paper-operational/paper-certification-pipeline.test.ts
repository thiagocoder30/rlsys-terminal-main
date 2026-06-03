import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PaperCertificationPipeline,
  type PaperCertificationPipelineInput,
} from '../../../src/infrastructure/paper-operational/paper-certification-pipeline';

const validInput: PaperCertificationPipelineInput = {
  sessionId: 'paper-session-211',
  warmupRounds: 200,
  readinessApproved: true,
  institutionalConsensusApproved: true,
  riskApproved: true,
  operatorApproved: true,
  minimumWarmupRounds: 100,
  confidenceScore: 0.92,
  minimumConfidenceScore: 0.7,
};

describe('PaperCertificationPipeline', () => {
  it('certifies paper-only sessions when all defensive gates pass', () => {
    const pipeline = new PaperCertificationPipeline();
    const result = pipeline.certify(validInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PAPER_CERTIFIED');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
    }
  });

  it('blocks sessions when any institutional gate fails', () => {
    const pipeline = new PaperCertificationPipeline();
    const result = pipeline.certify({
      ...validInput,
      riskApproved: false,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED');
      assert.ok(result.value.reasons.includes('RISK_BLOCKED'));
    }
  });

  it('requires review when confidence is below the institutional threshold', () => {
    const pipeline = new PaperCertificationPipeline();
    const result = pipeline.certify({
      ...validInput,
      confidenceScore: 0.61,
      minimumConfidenceScore: 0.7,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NEEDS_REVIEW');
      assert.ok(result.value.reasons.includes('CERTIFICATION_REQUIRES_REVIEW'));
    }
  });

  it('rejects invalid input through Result without silent failure', () => {
    const pipeline = new PaperCertificationPipeline();
    const result = pipeline.certify({
      ...validInput,
      sessionId: ' ',
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_CERTIFICATION_INPUT');
    }
  });

  it('blocks if unsafe policy is injected', () => {
    const pipeline = new PaperCertificationPipeline({
      productionMoneyAllowed: true,
      liveMoneyAuthorization: false,
    });

    const result = pipeline.certify(validInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED');
      assert.ok(result.value.reasons.includes('POLICY_LOCK_ACTIVE'));
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
    }
  });
});
