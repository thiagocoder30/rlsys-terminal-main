'use strict';

/**
 * @typedef {'VALID'|'INVALID'} WarmupIntegrityStatus
 */

/**
 * @typedef {Object} WarmupIntegrityInput
 * @property {string=} sessionId
 * @property {number[]} numbers
 * @property {number=} confidence
 * @property {string=} fingerprint
 * @property {string=} source
 * @property {boolean=} manualInputMode
 * @property {string=} operationalGate
 * @property {string=} paperGate
 * @property {string=} liveGate
 * @property {boolean=} productionMoneyAllowed
 * @property {boolean=} liveMoneyAuthorized
 */

/**
 * @typedef {Object} WarmupIntegrityConfig
 * @property {number[]} allowedWarmupSizes
 * @property {number} minConfidence
 * @property {number} maxSingleNumberDominanceRatio
 * @property {number} maxConsecutiveRepeat
 */

/**
 * @typedef {Object} WarmupIntegrityReport
 * @property {WarmupIntegrityStatus} status
 * @property {boolean} valid
 * @property {string[]} reasons
 * @property {number} roundsValidated
 * @property {number} uniqueNumbers
 * @property {number} singleNumberDominanceRatio
 * @property {number} maxObservedConsecutiveRepeat
 * @property {boolean} manualInputMode
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Validates institutional integrity of a bootstrapped warm-up state.
 *
 * This component is intentionally conservative. It checks structural validity,
 * roulette bounds, defensive gate invariants and simple anti-corruption signals.
 * It is O(n), deterministic and has no side effects.
 */
class WarmupIntegrityValidator {
  /**
   * @param {Partial<WarmupIntegrityConfig>=} config
   */
  constructor(config) {
    const allowedWarmupSizes = Array.isArray(config && config.allowedWarmupSizes)
      ? config.allowedWarmupSizes.slice()
      : [100, 200];

    this.config = Object.freeze({
      allowedWarmupSizes: Object.freeze(allowedWarmupSizes),
      minConfidence: Number.isFinite(config && config.minConfidence) ? Number(config.minConfidence) : 0.82,
      maxSingleNumberDominanceRatio: Number.isFinite(config && config.maxSingleNumberDominanceRatio)
        ? Number(config.maxSingleNumberDominanceRatio)
        : 0.18,
      maxConsecutiveRepeat: Number.isInteger(config && config.maxConsecutiveRepeat)
        ? Number(config.maxConsecutiveRepeat)
        : 8
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {WarmupIntegrityInput} input
   * @returns {WarmupIntegrityReport}
   */
  validate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.buildReport(false, ['input_not_object'], [], false);
    }

    const numbers = Array.isArray(input.numbers) ? input.numbers : [];
    const confidence = Number.isFinite(input.confidence) ? Number(input.confidence) : 0;
    const manualInputMode = input.manualInputMode === true;

    if (!this.config.allowedWarmupSizes.includes(numbers.length)) {
      reasons.push('invalid_warmup_size');
    }

    if (confidence < this.config.minConfidence) {
      reasons.push('confidence_below_minimum');
    }

    if (typeof input.sessionId !== 'string' || input.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (typeof input.fingerprint !== 'string' || input.fingerprint.length === 0) {
      reasons.push('missing_fingerprint');
    }

    if (manualInputMode !== true) {
      reasons.push('manual_input_mode_not_enabled');
    }

    if (input.operationalGate !== 'BLOCKED') {
      reasons.push('operational_gate_must_start_blocked');
    }

    if (input.paperGate !== 'BLOCKED') {
      reasons.push('paper_gate_must_start_blocked');
    }

    if (input.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    if (input.productionMoneyAllowed !== false) {
      reasons.push('production_money_must_remain_disabled');
    }

    if (input.liveMoneyAuthorized !== false) {
      reasons.push('live_money_must_remain_disabled');
    }

    const metrics = this.calculateMetrics(numbers);

    if (metrics.invalidNumberFound) {
      reasons.push('roulette_number_out_of_range');
    }

    if (metrics.singleNumberDominanceRatio > this.config.maxSingleNumberDominanceRatio) {
      reasons.push('single_number_dominance_too_high');
    }

    if (metrics.maxObservedConsecutiveRepeat > this.config.maxConsecutiveRepeat) {
      reasons.push('consecutive_repeat_too_high');
    }

    return Object.freeze({
      status: reasons.length === 0 ? 'VALID' : 'INVALID',
      valid: reasons.length === 0,
      reasons: Object.freeze(reasons),
      roundsValidated: numbers.length,
      uniqueNumbers: metrics.uniqueNumbers,
      singleNumberDominanceRatio: this.round4(metrics.singleNumberDominanceRatio),
      maxObservedConsecutiveRepeat: metrics.maxObservedConsecutiveRepeat,
      manualInputMode,
      operationalGate: input.operationalGate || 'UNKNOWN',
      paperGate: input.paperGate || 'UNKNOWN',
      liveGate: input.liveGate || 'UNKNOWN',
      productionMoneyAllowed: input.productionMoneyAllowed === true,
      liveMoneyAuthorized: input.liveMoneyAuthorized === true
    });
  }

  /**
   * @param {number[]} numbers
   * @returns {{
   *   invalidNumberFound: boolean,
   *   uniqueNumbers: number,
   *   singleNumberDominanceRatio: number,
   *   maxObservedConsecutiveRepeat: number
   * }}
   */
  calculateMetrics(numbers) {
    const frequency = new Map();
    let invalidNumberFound = false;
    let maxFrequency = 0;
    let maxObservedConsecutiveRepeat = 0;
    let currentRepeat = 0;
    let previousNumber = null;

    for (let index = 0; index < numbers.length; index += 1) {
      const value = numbers[index];

      if (!Number.isInteger(value) || value < 0 || value > 36) {
        invalidNumberFound = true;
        continue;
      }

      const nextFrequency = (frequency.get(value) || 0) + 1;
      frequency.set(value, nextFrequency);

      if (nextFrequency > maxFrequency) {
        maxFrequency = nextFrequency;
      }

      if (value === previousNumber) {
        currentRepeat += 1;
      } else {
        currentRepeat = 1;
        previousNumber = value;
      }

      if (currentRepeat > maxObservedConsecutiveRepeat) {
        maxObservedConsecutiveRepeat = currentRepeat;
      }
    }

    return {
      invalidNumberFound,
      uniqueNumbers: frequency.size,
      singleNumberDominanceRatio: numbers.length === 0 ? 0 : maxFrequency / numbers.length,
      maxObservedConsecutiveRepeat
    };
  }

  /**
   * @param {boolean} valid
   * @param {string[]} reasons
   * @param {number[]} numbers
   * @param {boolean} manualInputMode
   * @returns {WarmupIntegrityReport}
   */
  buildReport(valid, reasons, numbers, manualInputMode) {
    return Object.freeze({
      status: valid ? 'VALID' : 'INVALID',
      valid,
      reasons: Object.freeze(reasons.slice()),
      roundsValidated: numbers.length,
      uniqueNumbers: 0,
      singleNumberDominanceRatio: 0,
      maxObservedConsecutiveRepeat: 0,
      manualInputMode,
      operationalGate: 'UNKNOWN',
      paperGate: 'UNKNOWN',
      liveGate: 'UNKNOWN',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /**
   * @param {WarmupIntegrityConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.allowedWarmupSizes.length === 0) {
      throw new Error('allowedWarmupSizes must not be empty');
    }

    for (let index = 0; index < config.allowedWarmupSizes.length; index += 1) {
      const size = config.allowedWarmupSizes[index];

      if (!Number.isInteger(size) || size < 1) {
        throw new Error('allowedWarmupSizes must contain positive integers');
      }
    }

    if (config.minConfidence < 0 || config.minConfidence > 1) {
      throw new Error('minConfidence must be between 0 and 1');
    }

    if (config.maxSingleNumberDominanceRatio <= 0 || config.maxSingleNumberDominanceRatio > 1) {
      throw new Error('maxSingleNumberDominanceRatio must be within 0..1');
    }

    if (config.maxConsecutiveRepeat < 1) {
      throw new Error('maxConsecutiveRepeat must be greater than zero');
    }
  }
}

module.exports = {
  WarmupIntegrityValidator
};
