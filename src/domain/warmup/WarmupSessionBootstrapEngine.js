'use strict';

/**
 * @typedef {'OCR_UPLOAD'|'MANUAL_IMPORT'} WarmupSource
 * @typedef {'BLOCKED'} InstitutionalGateState
 */

/**
 * @typedef {Object} WarmupBootstrapInput
 * @property {number[]} numbers
 * @property {WarmupSource} source
 * @property {number=} confidence
 * @property {string[]=} warnings
 */

/**
 * @typedef {Object} WarmupBootstrapConfig
 * @property {number[]} allowedWarmupSizes
 * @property {number} minConfidence
 */

/**
 * @typedef {Object} InstitutionalWarmupState
 * @property {string} sessionId
 * @property {WarmupSource} source
 * @property {number[]} numbers
 * @property {number} roundsLoaded
 * @property {number} confidence
 * @property {string[]} warnings
 * @property {string} fingerprint
 * @property {boolean} manualInputMode
 * @property {InstitutionalGateState} operationalGate
 * @property {InstitutionalGateState} paperGate
 * @property {InstitutionalGateState} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * @typedef {Object} WarmupBootstrapResult
 * @property {boolean} ok
 * @property {InstitutionalWarmupState=} value
 * @property {{ code: string, reasons: string[] }=} error
 */

/**
 * Builds the institutional initial state from a validated warm-up sample.
 *
 * The engine is deterministic, idempotent and O(n). It does not authorize
 * PAPER or live money. It only creates the safe initial session state that
 * later authorization engines may evaluate.
 */
class WarmupSessionBootstrapEngine {
  /**
   * @param {Partial<WarmupBootstrapConfig>=} config
   */
  constructor(config) {
    const allowedWarmupSizes = Array.isArray(config && config.allowedWarmupSizes)
      ? config.allowedWarmupSizes.slice()
      : [100, 200];

    this.config = Object.freeze({
      allowedWarmupSizes: Object.freeze(allowedWarmupSizes),
      minConfidence: Number.isFinite(config && config.minConfidence) ? Number(config.minConfidence) : 0.82
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {WarmupBootstrapInput} input
   * @returns {WarmupBootstrapResult}
   */
  bootstrap(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.reject('invalid_warmup_input', ['input_not_object']);
    }

    const numbers = Array.isArray(input.numbers) ? input.numbers.slice() : [];
    const source = input.source;
    const confidence = Number.isFinite(input.confidence) ? Number(input.confidence) : 1;
    const warnings = Array.isArray(input.warnings) ? input.warnings.slice() : [];

    if (source !== 'OCR_UPLOAD' && source !== 'MANUAL_IMPORT') {
      reasons.push('invalid_warmup_source');
    }

    if (!this.config.allowedWarmupSizes.includes(numbers.length)) {
      reasons.push('invalid_warmup_size');
    }

    if (confidence < this.config.minConfidence) {
      reasons.push('warmup_confidence_below_minimum');
    }

    for (let index = 0; index < numbers.length; index += 1) {
      const value = numbers[index];

      if (!Number.isInteger(value) || value < 0 || value > 36) {
        reasons.push('roulette_number_out_of_range');
        break;
      }
    }

    if (reasons.length > 0) {
      return this.reject('warmup_bootstrap_rejected', reasons);
    }

    const fingerprint = this.createFingerprint(numbers, source, confidence);
    const sessionId = `warmup-${numbers.length}-${fingerprint}`;

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        sessionId,
        source,
        numbers: Object.freeze(numbers),
        roundsLoaded: numbers.length,
        confidence,
        warnings: Object.freeze(warnings),
        fingerprint,
        manualInputMode: true,
        operationalGate: 'BLOCKED',
        paperGate: 'BLOCKED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  /**
   * @param {string} code
   * @param {string[]} reasons
   * @returns {WarmupBootstrapResult}
   */
  reject(code, reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  /**
   * Lightweight deterministic FNV-1a style fingerprint.
   *
   * @param {number[]} numbers
   * @param {WarmupSource} source
   * @param {number} confidence
   * @returns {string}
   */
  createFingerprint(numbers, source, confidence) {
    let hash = 2166136261;

    const seed = `${source}:${Math.round(confidence * 10000)}:${numbers.length}`;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    for (let index = 0; index < numbers.length; index += 1) {
      hash ^= numbers[index] + 31;
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * @param {WarmupBootstrapConfig} config
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
  }
}

module.exports = {
  WarmupSessionBootstrapEngine
};
