'use strict';

/**
 * @typedef {'MANUAL_ROUND_ACCEPTED'|'SESSION_UPDATE_REJECTED'} IncrementalUpdateStatus
 */

/**
 * @typedef {Object} IncrementalSessionState
 * @property {string} sessionId
 * @property {number[]} rounds
 * @property {number} totalRounds
 * @property {number} lastNumber
 * @property {number} uniqueNumbers
 * @property {number} zeroCount
 * @property {number} repeatStreak
 * @property {number} maxRepeatStreak
 * @property {number} manualUpdates
 * @property {string} inputMode
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * @typedef {Object} IncrementalSessionUpdateInput
 * @property {IncrementalSessionState} state
 * @property {number} nextNumber
 * @property {string=} source
 */

/**
 * @typedef {Object} IncrementalSessionUpdateConfig
 * @property {number} maxRounds
 */

/**
 * @typedef {Object} IncrementalSessionUpdateDecision
 * @property {IncrementalUpdateStatus} status
 * @property {boolean} accepted
 * @property {IncrementalSessionState=} state
 * @property {string[]} reasons
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Updates a PAPER session incrementally from manual roulette numbers.
 *
 * This engine is pure and deterministic. It does not persist state and does not
 * authorize live money. It produces the next immutable session state after one
 * manually entered roulette result.
 */
class IncrementalSessionUpdateEngine {
  /**
   * @param {Partial<IncrementalSessionUpdateConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      maxRounds: Number.isInteger(config && config.maxRounds) ? Number(config.maxRounds) : 1000
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {string} sessionId
   * @param {number[]} warmupRounds
   * @returns {{ ok: boolean, value?: IncrementalSessionState, error?: { code: string, reasons: string[] } }}
   */
  createInitialState(sessionId, warmupRounds) {
    const reasons = [];

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    const rounds = Array.isArray(warmupRounds) ? warmupRounds.slice() : [];
    this.validateRounds(rounds, reasons);

    if (rounds.length > this.config.maxRounds) {
      reasons.push('max_rounds_exceeded');
    }

    if (reasons.length > 0) {
      return this.rejectCreate(reasons);
    }

    return Object.freeze({
      ok: true,
      value: this.buildState(sessionId, rounds, 0)
    });
  }

  /**
   * @param {IncrementalSessionUpdateInput} input
   * @returns {IncrementalSessionUpdateDecision}
   */
  apply(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const state = input.state;

    if (!state || typeof state !== 'object') {
      return this.reject(['missing_session_state']);
    }

    this.validateStateInvariants(state, reasons);

    const nextNumber = input.nextNumber;

    if (!Number.isInteger(nextNumber) || nextNumber < 0 || nextNumber > 36) {
      reasons.push('roulette_number_out_of_range');
    }

    const currentRounds = Array.isArray(state.rounds) ? state.rounds : [];

    if (currentRounds.length >= this.config.maxRounds) {
      reasons.push('max_rounds_exceeded');
    }

    if (input.source && input.source !== 'MANUAL_INPUT') {
      reasons.push('only_manual_input_allowed_after_warmup');
    }

    if (reasons.length > 0) {
      return this.reject(reasons);
    }

    const nextRounds = currentRounds.slice();
    nextRounds.push(nextNumber);

    const nextState = this.buildState(
      state.sessionId,
      nextRounds,
      (Number.isInteger(state.manualUpdates) ? state.manualUpdates : 0) + 1
    );

    return Object.freeze({
      status: 'MANUAL_ROUND_ACCEPTED',
      accepted: true,
      state: nextState,
      reasons: Object.freeze([]),
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {string} sessionId
   * @param {number[]} rounds
   * @param {number} manualUpdates
   * @returns {IncrementalSessionState}
   */
  buildState(sessionId, rounds, manualUpdates) {
    const metrics = this.calculateMetrics(rounds);

    return Object.freeze({
      sessionId,
      rounds: Object.freeze(rounds.slice()),
      totalRounds: rounds.length,
      lastNumber: rounds.length === 0 ? -1 : rounds[rounds.length - 1],
      uniqueNumbers: metrics.uniqueNumbers,
      zeroCount: metrics.zeroCount,
      repeatStreak: metrics.repeatStreak,
      maxRepeatStreak: metrics.maxRepeatStreak,
      manualUpdates,
      inputMode: 'MANUAL_INPUT',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {number[]} rounds
   * @returns {{ uniqueNumbers: number, zeroCount: number, repeatStreak: number, maxRepeatStreak: number }}
   */
  calculateMetrics(rounds) {
    const seen = new Set();
    let zeroCount = 0;
    let repeatStreak = 0;
    let maxRepeatStreak = 0;
    let previous = null;

    for (let index = 0; index < rounds.length; index += 1) {
      const value = rounds[index];
      seen.add(value);

      if (value === 0) {
        zeroCount += 1;
      }

      if (value === previous) {
        repeatStreak += 1;
      } else {
        repeatStreak = 1;
        previous = value;
      }

      if (repeatStreak > maxRepeatStreak) {
        maxRepeatStreak = repeatStreak;
      }
    }

    return {
      uniqueNumbers: seen.size,
      zeroCount,
      repeatStreak,
      maxRepeatStreak
    };
  }

  /**
   * @param {number[]} rounds
   * @param {string[]} reasons
   * @returns {void}
   */
  validateRounds(rounds, reasons) {
    for (let index = 0; index < rounds.length; index += 1) {
      const value = rounds[index];

      if (!Number.isInteger(value) || value < 0 || value > 36) {
        reasons.push('roulette_number_out_of_range');
        return;
      }
    }
  }

  /**
   * @param {IncrementalSessionState} state
   * @param {string[]} reasons
   * @returns {void}
   */
  validateStateInvariants(state, reasons) {
    if (typeof state.sessionId !== 'string' || state.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (!Array.isArray(state.rounds)) {
      reasons.push('rounds_not_array');
      return;
    }

    this.validateRounds(state.rounds, reasons);

    if (state.inputMode !== 'MANUAL_INPUT') {
      reasons.push('manual_input_mode_required');
    }

    if (state.operationalGate !== 'PAPER_AUTHORIZED') {
      reasons.push('operational_gate_must_be_paper_authorized');
    }

    if (state.paperGate !== 'PAPER_AUTHORIZED') {
      reasons.push('paper_gate_must_be_paper_authorized');
    }

    if (state.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    if (state.productionMoneyAllowed !== false) {
      reasons.push('production_money_must_remain_disabled');
    }

    if (state.liveMoneyAuthorized !== false) {
      reasons.push('live_money_must_remain_disabled');
    }
  }

  /**
   * @param {string[]} reasons
   * @returns {{ ok: false, error: { code: string, reasons: string[] } }}
   */
  rejectCreate(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'incremental_session_state_rejected',
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  /**
   * @param {string[]} reasons
   * @returns {IncrementalSessionUpdateDecision}
   */
  reject(reasons) {
    return Object.freeze({
      status: 'SESSION_UPDATE_REJECTED',
      accepted: false,
      reasons: Object.freeze(reasons.slice()),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {IncrementalSessionUpdateConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.maxRounds < 1) {
      throw new Error('maxRounds must be greater than zero');
    }
  }
}

module.exports = {
  IncrementalSessionUpdateEngine
};
