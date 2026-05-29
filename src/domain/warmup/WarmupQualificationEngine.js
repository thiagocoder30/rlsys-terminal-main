'use strict';

/**
 * @typedef {'APPROVED'|'REJECTED'} WarmupQualificationStatus
 */

/**
 * @typedef {Object} WarmupQualificationInput
 * @property {Object} warmupState
 * @property {Object} integrityReport
 */

/**
 * @typedef {Object} WarmupQualificationConfig
 * @property {number} minQualificationScore
 * @property {number} minConfidence
 * @property {number} maxSingleNumberDominanceRatio
 * @property {number} minUniqueCoverageRatio
 */

/**
 * @typedef {Object} WarmupQualificationDecision
 * @property {WarmupQualificationStatus} status
 * @property {boolean} approved
 * @property {number} qualificationScore
 * @property {string[]} reasons
 * @property {number} confidenceComponent
 * @property {number} integrityComponent
 * @property {number} diversityComponent
 * @property {number} dominanceComponent
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Produces an institutional warm-up qualification decision.
 *
 * This engine consumes:
 * - WarmupSessionBootstrapEngine output
 * - WarmupIntegrityValidator output
 *
 * It does not authorize a session. It only states whether the warm-up is
 * qualified enough to be evaluated by later authorization engines.
 */
class WarmupQualificationEngine {
  /**
   * @param {Partial<WarmupQualificationConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      minQualificationScore: Number.isFinite(config && config.minQualificationScore)
        ? Number(config.minQualificationScore)
        : 0.74,
      minConfidence: Number.isFinite(config && config.minConfidence)
        ? Number(config.minConfidence)
        : 0.82,
      maxSingleNumberDominanceRatio: Number.isFinite(config && config.maxSingleNumberDominanceRatio)
        ? Number(config.maxSingleNumberDominanceRatio)
        : 0.18,
      minUniqueCoverageRatio: Number.isFinite(config && config.minUniqueCoverageRatio)
        ? Number(config.minUniqueCoverageRatio)
        : 0.45
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {WarmupQualificationInput} input
   * @returns {WarmupQualificationDecision}
   */
  qualify(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const warmupState = input.warmupState;
    const integrityReport = input.integrityReport;

    if (!warmupState || typeof warmupState !== 'object') {
      return this.reject(['missing_warmup_state']);
    }

    if (!integrityReport || typeof integrityReport !== 'object') {
      return this.reject(['missing_integrity_report']);
    }

    if (integrityReport.valid !== true || integrityReport.status !== 'VALID') {
      reasons.push('integrity_report_invalid');
    }

    if (warmupState.productionMoneyAllowed !== false) {
      reasons.push('production_money_invariant_violation');
    }

    if (warmupState.liveMoneyAuthorized !== false) {
      reasons.push('live_money_invariant_violation');
    }

    if (warmupState.operationalGate !== 'BLOCKED') {
      reasons.push('operational_gate_must_remain_blocked');
    }

    if (warmupState.paperGate !== 'BLOCKED') {
      reasons.push('paper_gate_must_remain_blocked');
    }

    if (warmupState.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    const confidence = Number.isFinite(warmupState.confidence) ? this.clamp01(warmupState.confidence) : 0;
    const roundsLoaded = Number.isInteger(warmupState.roundsLoaded) ? warmupState.roundsLoaded : 0;
    const uniqueNumbers = Number.isInteger(integrityReport.uniqueNumbers) ? integrityReport.uniqueNumbers : 0;
    const dominanceRatio = Number.isFinite(integrityReport.singleNumberDominanceRatio)
      ? this.clamp01(integrityReport.singleNumberDominanceRatio)
      : 1;

    if (confidence < this.config.minConfidence) {
      reasons.push('confidence_below_qualification_minimum');
    }

    if (dominanceRatio > this.config.maxSingleNumberDominanceRatio) {
      reasons.push('dominance_above_qualification_limit');
    }

    const confidenceComponent = confidence;
    const integrityComponent = integrityReport.valid === true ? 1 : 0;
    const diversityComponent = roundsLoaded <= 0 ? 0 : this.clamp01(uniqueNumbers / 37);
    const dominanceComponent = this.clamp01(1 - dominanceRatio);

    if (diversityComponent < this.config.minUniqueCoverageRatio) {
      reasons.push('unique_coverage_below_minimum');
    }

    const score = this.round4(
      confidenceComponent * 0.34 +
      integrityComponent * 0.34 +
      diversityComponent * 0.18 +
      dominanceComponent * 0.14
    );

    if (score < this.config.minQualificationScore) {
      reasons.push('qualification_score_below_minimum');
    }

    const approved = reasons.length === 0;

    return Object.freeze({
      status: approved ? 'APPROVED' : 'REJECTED',
      approved,
      qualificationScore: score,
      reasons: Object.freeze(reasons),
      confidenceComponent: this.round4(confidenceComponent),
      integrityComponent: this.round4(integrityComponent),
      diversityComponent: this.round4(diversityComponent),
      dominanceComponent: this.round4(dominanceComponent),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {string[]} reasons
   * @returns {WarmupQualificationDecision}
   */
  reject(reasons) {
    return Object.freeze({
      status: 'REJECTED',
      approved: false,
      qualificationScore: 0,
      reasons: Object.freeze(reasons.slice()),
      confidenceComponent: 0,
      integrityComponent: 0,
      diversityComponent: 0,
      dominanceComponent: 0,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  clamp01(value) {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /**
   * @param {WarmupQualificationConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.minQualificationScore < 0 || config.minQualificationScore > 1) {
      throw new Error('minQualificationScore must be between 0 and 1');
    }

    if (config.minConfidence < 0 || config.minConfidence > 1) {
      throw new Error('minConfidence must be between 0 and 1');
    }

    if (config.maxSingleNumberDominanceRatio <= 0 || config.maxSingleNumberDominanceRatio > 1) {
      throw new Error('maxSingleNumberDominanceRatio must be within 0..1');
    }

    if (config.minUniqueCoverageRatio < 0 || config.minUniqueCoverageRatio > 1) {
      throw new Error('minUniqueCoverageRatio must be between 0 and 1');
    }
  }
}

module.exports = {
  WarmupQualificationEngine
};
