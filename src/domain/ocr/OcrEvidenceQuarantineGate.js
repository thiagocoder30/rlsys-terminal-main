'use strict';

/**
 * @typedef {'ALLOW'|'QUARANTINE'} OcrEvidenceQuarantineDecisionType
 */

/**
 * @typedef {Object} OcrEvidenceCandidate
 * @property {number[]} numbers
 * @property {number} confidence
 * @property {string=} source
 * @property {number=} timestamp
 * @property {string[]=} warnings
 */

/**
 * @typedef {Object} OcrEvidenceQuarantineConfig
 * @property {number} minConfidence
 * @property {number} minNumbers
 * @property {number} maxNumbers
 * @property {number} rouletteMinNumber
 * @property {number} rouletteMaxNumber
 * @property {number} maxWarnings
 */

/**
 * @typedef {Object} OcrEvidenceQuarantineDecision
 * @property {OcrEvidenceQuarantineDecisionType} status
 * @property {boolean} allowed
 * @property {string[]} reasons
 * @property {number} confidence
 * @property {number} acceptedNumbers
 * @property {boolean} productionMoneyAllowed
 */

/**
 * Defensive quarantine gate for OCR evidence.
 *
 * This component validates OCR-derived roulette evidence before it reaches
 * contextual analyzers. It is intentionally conservative and never authorizes
 * live-money operation.
 */
class OcrEvidenceQuarantineGate {
  /**
   * @param {Partial<OcrEvidenceQuarantineConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      minConfidence: Number.isFinite(config && config.minConfidence) ? Number(config.minConfidence) : 0.82,
      minNumbers: Number.isInteger(config && config.minNumbers) ? Number(config.minNumbers) : 12,
      maxNumbers: Number.isInteger(config && config.maxNumbers) ? Number(config.maxNumbers) : 240,
      rouletteMinNumber: 0,
      rouletteMaxNumber: 36,
      maxWarnings: Number.isInteger(config && config.maxWarnings) ? Number(config.maxWarnings) : 2
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {OcrEvidenceCandidate} candidate
   * @returns {OcrEvidenceQuarantineDecision}
   */
  evaluate(candidate) {
    const reasons = [];

    if (!candidate || typeof candidate !== 'object') {
      return this.quarantine(['candidate_not_object'], 0, 0);
    }

    const numbers = Array.isArray(candidate.numbers) ? candidate.numbers : [];
    const confidence = Number.isFinite(candidate.confidence) ? Number(candidate.confidence) : 0;
    const warnings = Array.isArray(candidate.warnings) ? candidate.warnings : [];

    if (numbers.length < this.config.minNumbers) {
      reasons.push('insufficient_ocr_numbers');
    }

    if (numbers.length > this.config.maxNumbers) {
      reasons.push('excessive_ocr_numbers');
    }

    if (confidence < this.config.minConfidence) {
      reasons.push('low_ocr_confidence');
    }

    if (warnings.length > this.config.maxWarnings) {
      reasons.push('too_many_ocr_warnings');
    }

    for (let index = 0; index < numbers.length; index += 1) {
      const value = numbers[index];

      if (!Number.isInteger(value)) {
        reasons.push('non_integer_roulette_number');
        break;
      }

      if (value < this.config.rouletteMinNumber || value > this.config.rouletteMaxNumber) {
        reasons.push('roulette_number_out_of_range');
        break;
      }
    }

    if (reasons.length > 0) {
      return this.quarantine(reasons, confidence, numbers.length);
    }

    return Object.freeze({
      status: 'ALLOW',
      allowed: true,
      reasons: [],
      confidence,
      acceptedNumbers: numbers.length,
      productionMoneyAllowed: false
    });
  }

  /**
   * @param {string[]} reasons
   * @param {number} confidence
   * @param {number} acceptedNumbers
   * @returns {OcrEvidenceQuarantineDecision}
   */
  quarantine(reasons, confidence, acceptedNumbers) {
    return Object.freeze({
      status: 'QUARANTINE',
      allowed: false,
      reasons: Object.freeze(reasons.slice()),
      confidence,
      acceptedNumbers,
      productionMoneyAllowed: false
    });
  }

  /**
   * @param {OcrEvidenceQuarantineConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.minConfidence < 0 || config.minConfidence > 1) {
      throw new Error('minConfidence must be between 0 and 1');
    }

    if (config.minNumbers < 1) {
      throw new Error('minNumbers must be greater than zero');
    }

    if (config.maxNumbers < config.minNumbers) {
      throw new Error('maxNumbers must be greater than or equal to minNumbers');
    }

    if (config.rouletteMinNumber !== 0 || config.rouletteMaxNumber !== 36) {
      throw new Error('roulette bounds must remain European roulette range 0..36');
    }
  }
}

module.exports = {
  OcrEvidenceQuarantineGate
};
