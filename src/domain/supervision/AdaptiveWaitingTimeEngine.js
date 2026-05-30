'use strict';

/**
 * @typedef {'LOW'|'MODERATE'|'HIGH'|'CRITICAL'} WaitingSeverityBand
 */

/**
 * @typedef {Object} AdaptiveWaitingTimeInput
 * @property {number} supervisionRiskScore
 * @property {number=} operatorInstabilityScore
 * @property {number=} tableInstabilityScore
 * @property {number=} recentBlockCount
 * @property {boolean=} vetoActive
 * @property {boolean=} chasingDetected
 * @property {boolean=} tiltDetected
 */

/**
 * @typedef {Object} AdaptiveWaitingTimeConfig
 * @property {number} minDurationMs
 * @property {number} lowDurationMs
 * @property {number} moderateDurationMs
 * @property {number} highDurationMs
 * @property {number} criticalDurationMs
 * @property {number} maxDurationMs
 */

/**
 * @typedef {Object} AdaptiveWaitingTimeDecision
 * @property {number} durationMs
 * @property {number} durationMinutes
 * @property {WaitingSeverityBand} severity
 * @property {number} severityScore
 * @property {string[]} reasons
 * @property {boolean} nonViolable
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Computes institutional cooldown waiting time based on risk severity.
 *
 * This engine is pure, deterministic and O(1). It does not persist locks.
 * The CooldownEnforcementEngine is responsible for enforcing the returned
 * duration as a non-violable cooldown.
 */
class AdaptiveWaitingTimeEngine {
  /**
   * @param {Partial<AdaptiveWaitingTimeConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      minDurationMs: Number.isInteger(config && config.minDurationMs) ? Number(config.minDurationMs) : 15 * 60 * 1000,
      lowDurationMs: Number.isInteger(config && config.lowDurationMs) ? Number(config.lowDurationMs) : 15 * 60 * 1000,
      moderateDurationMs: Number.isInteger(config && config.moderateDurationMs) ? Number(config.moderateDurationMs) : 30 * 60 * 1000,
      highDurationMs: Number.isInteger(config && config.highDurationMs) ? Number(config.highDurationMs) : 45 * 60 * 1000,
      criticalDurationMs: Number.isInteger(config && config.criticalDurationMs) ? Number(config.criticalDurationMs) : 60 * 60 * 1000,
      maxDurationMs: Number.isInteger(config && config.maxDurationMs) ? Number(config.maxDurationMs) : 120 * 60 * 1000
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {AdaptiveWaitingTimeInput} input
   * @returns {{ ok: boolean, value?: AdaptiveWaitingTimeDecision, error?: { code: string, reasons: string[] } }}
   */
  calculate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const supervisionRiskScore = this.readRequiredScore(input.supervisionRiskScore, 'invalid_supervision_risk_score', reasons);
    const operatorInstabilityScore = this.readOptionalScore(input.operatorInstabilityScore);
    const tableInstabilityScore = this.readOptionalScore(input.tableInstabilityScore);
    const recentBlockCount = Number.isInteger(input.recentBlockCount) && input.recentBlockCount > 0
      ? input.recentBlockCount
      : 0;

    if (reasons.length > 0) {
      return this.reject(reasons);
    }

    let severityScore =
      supervisionRiskScore * 0.46 +
      operatorInstabilityScore * 0.24 +
      tableInstabilityScore * 0.18 +
      Math.min(recentBlockCount, 5) * 0.024;

    if (input.vetoActive === true) {
      severityScore += 0.12;
      reasons.push('veto_active');
    }

    if (input.chasingDetected === true) {
      severityScore += 0.10;
      reasons.push('chasing_detected');
    }

    if (input.tiltDetected === true) {
      severityScore += 0.10;
      reasons.push('tilt_detected');
    }

    if (recentBlockCount > 0) {
      reasons.push('recent_blocks_present');
    }

    severityScore = this.round4(this.clamp01(severityScore));

    const severity = this.resolveSeverity(severityScore);
    const durationMs = this.resolveDuration(severity, recentBlockCount);

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        durationMs,
        durationMinutes: Math.round(durationMs / 60000),
        severity,
        severityScore,
        reasons: Object.freeze(reasons.slice()),
        nonViolable: true,
        operationalGate: 'BLOCKED',
        paperGate: 'BLOCKED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  /**
   * @param {number} score
   * @returns {WaitingSeverityBand}
   */
  resolveSeverity(score) {
    if (score >= 0.82) {
      return 'CRITICAL';
    }

    if (score >= 0.62) {
      return 'HIGH';
    }

    if (score >= 0.38) {
      return 'MODERATE';
    }

    return 'LOW';
  }

  /**
   * @param {WaitingSeverityBand} severity
   * @param {number} recentBlockCount
   * @returns {number}
   */
  resolveDuration(severity, recentBlockCount) {
    let baseDurationMs = this.config.lowDurationMs;

    if (severity === 'MODERATE') {
      baseDurationMs = this.config.moderateDurationMs;
    } else if (severity === 'HIGH') {
      baseDurationMs = this.config.highDurationMs;
    } else if (severity === 'CRITICAL') {
      baseDurationMs = this.config.criticalDurationMs;
    }

    const recurrencePenaltyMs = Math.min(recentBlockCount, 5) * 5 * 60 * 1000;
    return Math.min(baseDurationMs + recurrencePenaltyMs, this.config.maxDurationMs);
  }

  /**
   * @param {number} value
   * @param {string} reason
   * @param {string[]} reasons
   * @returns {number}
   */
  readRequiredScore(value, reason, reasons) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      reasons.push(reason);
      return 0;
    }

    return value;
  }

  /**
   * @param {number|undefined} value
   * @returns {number}
   */
  readOptionalScore(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.clamp01(value);
  }

  /**
   * @param {string[]} reasons
   * @returns {{ ok: false, error: { code: string, reasons: string[] } }}
   */
  reject(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'adaptive_waiting_time_rejected',
        reasons: Object.freeze(reasons.slice())
      })
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
   * @param {AdaptiveWaitingTimeConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.minDurationMs < 1) {
      throw new Error('minDurationMs must be greater than zero');
    }

    if (config.lowDurationMs < config.minDurationMs) {
      throw new Error('lowDurationMs must be greater than or equal to minDurationMs');
    }

    if (config.moderateDurationMs < config.lowDurationMs) {
      throw new Error('moderateDurationMs must be greater than or equal to lowDurationMs');
    }

    if (config.highDurationMs < config.moderateDurationMs) {
      throw new Error('highDurationMs must be greater than or equal to moderateDurationMs');
    }

    if (config.criticalDurationMs < config.highDurationMs) {
      throw new Error('criticalDurationMs must be greater than or equal to highDurationMs');
    }

    if (config.maxDurationMs < config.criticalDurationMs) {
      throw new Error('maxDurationMs must be greater than or equal to criticalDurationMs');
    }
  }
}

module.exports = {
  AdaptiveWaitingTimeEngine
};
