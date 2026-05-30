'use strict';

/**
 * @typedef {'ACTIVE'|'EXPIRED'|'NOT_REQUIRED'|'INVALID'} CooldownEnforcementStatus
 */

/**
 * @typedef {Object} CooldownLock
 * @property {string} lockId
 * @property {string} reason
 * @property {number} startedAtMs
 * @property {number} expiresAtMs
 * @property {number} durationMs
 * @property {boolean} nonViolable
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * @typedef {Object} CooldownCreateInput
 * @property {string} reason
 * @property {number} nowMs
 * @property {number=} durationMs
 * @property {string=} sessionId
 */

/**
 * @typedef {Object} CooldownEvaluateInput
 * @property {CooldownLock=} lock
 * @property {number} nowMs
 */

/**
 * @typedef {Object} CooldownEnforcementConfig
 * @property {number} defaultDurationMs
 * @property {number} minDurationMs
 * @property {number} maxDurationMs
 */

/**
 * @typedef {Object} CooldownEnforcementDecision
 * @property {CooldownEnforcementStatus} status
 * @property {boolean} blocked
 * @property {boolean} canStartSession
 * @property {number} remainingMs
 * @property {string[]} reasons
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Enforces non-violable institutional cooldowns.
 *
 * This engine is pure, deterministic and side-effect free. It creates and
 * evaluates cooldown locks, but does not persist them. Persistence belongs to
 * infrastructure adapters. Live money remains permanently disabled.
 */
class CooldownEnforcementEngine {
  /**
   * @param {Partial<CooldownEnforcementConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      defaultDurationMs: Number.isInteger(config && config.defaultDurationMs)
        ? Number(config.defaultDurationMs)
        : 30 * 60 * 1000,
      minDurationMs: Number.isInteger(config && config.minDurationMs)
        ? Number(config.minDurationMs)
        : 5 * 60 * 1000,
      maxDurationMs: Number.isInteger(config && config.maxDurationMs)
        ? Number(config.maxDurationMs)
        : 120 * 60 * 1000
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {CooldownCreateInput} input
   * @returns {{ ok: boolean, value?: CooldownLock, error?: { code: string, reasons: string[] } }}
   */
  createLock(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.rejectCreate('invalid_cooldown_input', ['input_not_object']);
    }

    const nowMs = Number.isInteger(input.nowMs) ? Number(input.nowMs) : NaN;
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const requestedDuration = Number.isInteger(input.durationMs)
      ? Number(input.durationMs)
      : this.config.defaultDurationMs;

    if (!Number.isInteger(nowMs) || nowMs < 0) {
      reasons.push('invalid_now_ms');
    }

    if (reason.length === 0) {
      reasons.push('missing_cooldown_reason');
    }

    if (requestedDuration < this.config.minDurationMs) {
      reasons.push('cooldown_duration_below_minimum');
    }

    if (requestedDuration > this.config.maxDurationMs) {
      reasons.push('cooldown_duration_above_maximum');
    }

    if (reasons.length > 0) {
      return this.rejectCreate('cooldown_lock_rejected', reasons);
    }

    const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0
      ? input.sessionId
      : 'sessionless';

    const lockId = this.createLockId(sessionId, reason, nowMs, requestedDuration);

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        lockId,
        reason,
        startedAtMs: nowMs,
        expiresAtMs: nowMs + requestedDuration,
        durationMs: requestedDuration,
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
   * @param {CooldownEvaluateInput} input
   * @returns {CooldownEnforcementDecision}
   */
  evaluate(input) {
    if (!input || typeof input !== 'object') {
      return this.invalid(['input_not_object']);
    }

    const nowMs = Number.isInteger(input.nowMs) ? Number(input.nowMs) : NaN;

    if (!Number.isInteger(nowMs) || nowMs < 0) {
      return this.invalid(['invalid_now_ms']);
    }

    if (!input.lock) {
      return Object.freeze({
        status: 'NOT_REQUIRED',
        blocked: false,
        canStartSession: true,
        remainingMs: 0,
        reasons: Object.freeze([]),
        operationalGate: 'BLOCKED',
        paperGate: 'BLOCKED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      });
    }

    const lockValidation = this.validateLock(input.lock);
    if (lockValidation.length > 0) {
      return this.invalid(lockValidation);
    }

    const remainingMs = Math.max(0, input.lock.expiresAtMs - nowMs);

    if (remainingMs > 0) {
      return Object.freeze({
        status: 'ACTIVE',
        blocked: true,
        canStartSession: false,
        remainingMs,
        reasons: Object.freeze(['cooldown_active']),
        operationalGate: 'BLOCKED',
        paperGate: 'BLOCKED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      });
    }

    return Object.freeze({
      status: 'EXPIRED',
      blocked: false,
      canStartSession: true,
      remainingMs: 0,
      reasons: Object.freeze([]),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {CooldownLock} lock
   * @returns {string[]}
   */
  validateLock(lock) {
    const reasons = [];

    if (!lock || typeof lock !== 'object') {
      return ['lock_not_object'];
    }

    if (typeof lock.lockId !== 'string' || lock.lockId.length === 0) {
      reasons.push('missing_lock_id');
    }

    if (lock.nonViolable !== true) {
      reasons.push('cooldown_must_be_non_violable');
    }

    if (!Number.isInteger(lock.startedAtMs) || lock.startedAtMs < 0) {
      reasons.push('invalid_started_at_ms');
    }

    if (!Number.isInteger(lock.expiresAtMs) || lock.expiresAtMs <= lock.startedAtMs) {
      reasons.push('invalid_expires_at_ms');
    }

    if (lock.operationalGate !== 'BLOCKED') {
      reasons.push('operational_gate_must_remain_blocked');
    }

    if (lock.paperGate !== 'BLOCKED') {
      reasons.push('paper_gate_must_remain_blocked');
    }

    if (lock.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    if (lock.productionMoneyAllowed !== false) {
      reasons.push('production_money_must_remain_disabled');
    }

    if (lock.liveMoneyAuthorized !== false) {
      reasons.push('live_money_must_remain_disabled');
    }

    return reasons;
  }

  /**
   * @param {string} code
   * @param {string[]} reasons
   * @returns {{ ok: false, error: { code: string, reasons: string[] } }}
   */
  rejectCreate(code, reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  /**
   * @param {string[]} reasons
   * @returns {CooldownEnforcementDecision}
   */
  invalid(reasons) {
    return Object.freeze({
      status: 'INVALID',
      blocked: true,
      canStartSession: false,
      remainingMs: 0,
      reasons: Object.freeze(reasons.slice()),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {string} sessionId
   * @param {string} reason
   * @param {number} nowMs
   * @param {number} durationMs
   * @returns {string}
   */
  createLockId(sessionId, reason, nowMs, durationMs) {
    let hash = 2166136261;
    const seed = `${sessionId}:${reason}:${nowMs}:${durationMs}`;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `cooldown-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  /**
   * @param {CooldownEnforcementConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.minDurationMs < 1) {
      throw new Error('minDurationMs must be greater than zero');
    }

    if (config.defaultDurationMs < config.minDurationMs) {
      throw new Error('defaultDurationMs must be greater than or equal to minDurationMs');
    }

    if (config.maxDurationMs < config.defaultDurationMs) {
      throw new Error('maxDurationMs must be greater than or equal to defaultDurationMs');
    }
  }
}

module.exports = {
  CooldownEnforcementEngine
};
