'use strict';

/**
 * @typedef {'STRONG'|'ACCEPTABLE'|'WEAK'|'REJECTED'} OcrEvidenceQualityBand
 */

/**
 * @typedef {Object} OcrEvidenceQualityCandidate
 * @property {number[]} numbers
 * @property {number} confidence
 * @property {string[]=} warnings
 */

/**
 * @typedef {Object} OcrEvidenceQualityConfig
 * @property {number} targetNumbers
 * @property {number} strongThreshold
 * @property {number} acceptableThreshold
 * @property {number} weakThreshold
 * @property {number} maxWarningPenalty
 */

/**
 * @typedef {Object} OcrEvidenceQualityScore
 * @property {number} score
 * @property {OcrEvidenceQualityBand} band
 * @property {number} confidenceComponent
 * @property {number} coverageComponent
 * @property {number} integrityComponent
 * @property {number} warningPenalty
 * @property {number} acceptedNumbers
 * @property {string[]} reasons
 * @property {boolean} productionMoneyAllowed
 */

/**
 * Scores OCR evidence quality after quarantine validation.
 *
 * This engine is deterministic, side-effect free and O(n). It never authorizes
 * real-money operation. It only produces a defensive evidence quality score.
 */
class OcrEvidenceQualityScoringEngine {
  /**
   * @param {Partial<OcrEvidenceQualityConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      targetNumbers: Number.isInteger(config && config.targetNumbers) ? Number(config.targetNumbers) : 100,
      strongThreshold: Number.isFinite(config && config.strongThreshold) ? Number(config.strongThreshold) : 0.86,
      acceptableThreshold: Number.isFinite(config && config.acceptableThreshold) ? Number(config.acceptableThreshold) : 0.72,
      weakThreshold: Number.isFinite(config && config.weakThreshold) ? Number(config.weakThreshold) : 0.55,
      maxWarningPenalty: Number.isFinite(config && config.maxWarningPenalty) ? Number(config.maxWarningPenalty) : 0.25
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {OcrEvidenceQualityCandidate} candidate
   * @returns {OcrEvidenceQualityScore}
   */
  score(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return this.buildRejected(['candidate_not_object'], 0, 0, 0, 0, 0);
    }

    const numbers = Array.isArray(candidate.numbers) ? candidate.numbers : [];
    const warnings = Array.isArray(candidate.warnings) ? candidate.warnings : [];
    const confidence = Number.isFinite(candidate.confidence) ? this.clamp01(candidate.confidence) : 0;

    let validNumbers = 0;
    const reasons = [];

    for (let index = 0; index < numbers.length; index += 1) {
      const value = numbers[index];

      if (Number.isInteger(value) && value >= 0 && value <= 36) {
        validNumbers += 1;
      }
    }

    if (numbers.length === 0) {
      reasons.push('empty_ocr_numbers');
    }

    if (validNumbers !== numbers.length) {
      reasons.push('invalid_roulette_numbers_present');
    }

    if (confidence <= 0) {
      reasons.push('missing_or_zero_confidence');
    }

    const confidenceComponent = confidence;
    const coverageComponent = this.clamp01(validNumbers / this.config.targetNumbers);
    const integrityComponent = numbers.length === 0 ? 0 : this.clamp01(validNumbers / numbers.length);
    const warningPenalty = this.calculateWarningPenalty(warnings.length);

    const rawScore =
      confidenceComponent * 0.45 +
      coverageComponent * 0.30 +
      integrityComponent * 0.25 -
      warningPenalty;

    const finalScore = this.round4(this.clamp01(rawScore));
    const band = this.resolveBand(finalScore, reasons);

    return Object.freeze({
      score: finalScore,
      band,
      confidenceComponent: this.round4(confidenceComponent),
      coverageComponent: this.round4(coverageComponent),
      integrityComponent: this.round4(integrityComponent),
      warningPenalty: this.round4(warningPenalty),
      acceptedNumbers: validNumbers,
      reasons: Object.freeze(reasons.slice()),
      productionMoneyAllowed: false
    });
  }

  /**
   * @param {number} warningCount
   * @returns {number}
   */
  calculateWarningPenalty(warningCount) {
    if (!Number.isInteger(warningCount) || warningCount <= 0) {
      return 0;
    }

    const scaledPenalty = warningCount * 0.05;
    return Math.min(scaledPenalty, this.config.maxWarningPenalty);
  }

  /**
   * @param {number} score
   * @param {string[]} reasons
   * @returns {OcrEvidenceQualityBand}
   */
  resolveBand(score, reasons) {
    if (reasons.length > 0 && score < this.config.weakThreshold) {
      return 'REJECTED';
    }

    if (score >= this.config.strongThreshold) {
      return 'STRONG';
    }

    if (score >= this.config.acceptableThreshold) {
      return 'ACCEPTABLE';
    }

    if (score >= this.config.weakThreshold) {
      return 'WEAK';
    }

    return 'REJECTED';
  }

  /**
   * @param {string[]} reasons
   * @param {number} confidenceComponent
   * @param {number} coverageComponent
   * @param {number} integrityComponent
   * @param {number} warningPenalty
   * @param {number} acceptedNumbers
   * @returns {OcrEvidenceQualityScore}
   */
  buildRejected(reasons, confidenceComponent, coverageComponent, integrityComponent, warningPenalty, acceptedNumbers) {
    return Object.freeze({
      score: 0,
      band: 'REJECTED',
      confidenceComponent,
      coverageComponent,
      integrityComponent,
      warningPenalty,
      acceptedNumbers,
      reasons: Object.freeze(reasons.slice()),
      productionMoneyAllowed: false
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
   * @param {OcrEvidenceQualityConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.targetNumbers < 1) {
      throw new Error('targetNumbers must be greater than zero');
    }

    if (
      config.weakThreshold < 0 ||
      config.acceptableThreshold < config.weakThreshold ||
      config.strongThreshold < config.acceptableThreshold ||
      config.strongThreshold > 1
    ) {
      throw new Error('quality thresholds must be ordered within 0..1');
    }

    if (config.maxWarningPenalty < 0 || config.maxWarningPenalty > 1) {
      throw new Error('maxWarningPenalty must be between 0 and 1');
    }
  }
}

module.exports = {
  OcrEvidenceQualityScoringEngine
};
