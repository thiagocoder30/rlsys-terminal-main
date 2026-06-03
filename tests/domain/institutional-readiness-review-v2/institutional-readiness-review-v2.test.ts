import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalReadinessReviewV2,
  type InstitutionalReadinessReviewV2Input,
} from '../../../src/domain/institutional-readiness-review-v2/institutional-readiness-review-v2';

const readyInput: InstitutionalReadinessReviewV2Input = {
  reviewId: 'readiness-v2-230',
  generatedAtEpochMs: 1000,
  modules: [
    { moduleName: 'Governance', status: 'ENABLED', score: 0.98, critical: true },
    { moduleName: 'PaperRuntime', status: 'ENABLED', score: 0.98, critical: true },
    { moduleName: 'ConsensusRuntime', status: 'ENABLED', score: 0.96, critical: true },
    { moduleName: 'LearningLayer', status: 'ENABLED', score: 0.92, critical: true },
    { moduleName: 'RecommendationLayer', status: 'ENABLED', score: 0.94, critical: true },
    { moduleName: 'TraceabilityLayer', status: 'ENABLED', score: 0.96, critical: true },
    { moduleName: 'AuditLayer', status: 'ENABLED', score: 0.96, critical: true },
    { moduleName: 'HudLayer', status: 'ENABLED', score: 0.82, critical: false },
  ],
};

describe('InstitutionalReadinessReviewV2', () => {
  it('classifies complete institutional paper stack as PAPER_READY', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review(readyInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PAPER_READY');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.readinessScore >= 0.82);
      assert.ok(result.value.reasons.includes('CORE_GOVERNANCE_READY'));
      assert.ok(result.value.reasons.includes('LEARNING_LAYER_READY'));
      assert.ok(result.value.reasons.includes('RECOMMENDATION_LAYER_READY'));
      assert.ok(result.value.reasons.includes('AUDIT_LAYER_READY'));
    }
  });

  it('blocks when any critical module is blocked', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review({
      ...readyInput,
      modules: readyInput.modules.map((module) =>
        module.moduleName === 'Governance'
          ? { ...module, status: 'BLOCKED' as const, score: 0.1 }
          : module,
      ),
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED');
      assert.ok(result.value.reasons.includes('MODULE_BLOCKED'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_BLOCK_ACTIVE'));
    }
  });

  it('requires review when critical modules are degraded beyond policy', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review({
      ...readyInput,
      modules: readyInput.modules.map((module) =>
        module.moduleName === 'LearningLayer' || module.moduleName === 'RecommendationLayer'
          ? { ...module, status: 'DEGRADED' as const, score: 0.62 }
          : module,
      ),
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NEEDS_REVIEW');
      assert.ok(result.value.reasons.includes('MODULE_DEGRADED'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_REVIEW_REQUIRED'));
    }
  });

  it('blocks very low readiness score defensively', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review({
      ...readyInput,
      modules: readyInput.modules.map((module) => ({
        ...module,
        status: 'DEGRADED' as const,
        score: 0.2,
        critical: false,
      })),
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED');
      assert.ok(result.value.reasons.includes('LOW_READINESS_SCORE'));
    }
  });

  it('rejects duplicate module names through Result', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review({
      ...readyInput,
      modules: [
        ...readyInput.modules,
        { moduleName: 'Governance', status: 'ENABLED', score: 0.9, critical: true },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
      );
    }
  });

  it('rejects invalid module scores through Result', () => {
    const review = new InstitutionalReadinessReviewV2();
    const result = review.review({
      ...readyInput,
      modules: [
        { moduleName: 'InvalidModule', status: 'ENABLED', score: 1.5, critical: true },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
      );
    }
  });
});
