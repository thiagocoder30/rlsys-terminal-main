'use strict';

/**
 * @typedef {'STABLE'|'WATCH'|'PRESSURE'|'CRITICAL'} LiveContextPressureBand
 */

/**
 * Composes a live institutional context snapshot from the current PAPER session.
 */
class LiveContextSnapshotEngine {
  constructor(config) {
    this.config = Object.freeze({
      recentWindowSize: Number.isInteger(config && config.recentWindowSize) ? Number(config.recentWindowSize) : 12,
      zeroPressureThreshold: Number.isInteger(config && config.zeroPressureThreshold) ? Number(config.zeroPressureThreshold) : 2,
      repeatPressureThreshold: Number.isInteger(config && config.repeatPressureThreshold) ? Number(config.repeatPressureThreshold) : 3
    });

    this.assertValidConfig(this.config);
  }

  compose(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const state = input.sessionState;

    if (!state || typeof state !== 'object') {
      return this.reject(['missing_session_state']);
    }

    this.validateState(state, reasons);

    if (reasons.length > 0) {
      return this.reject(reasons);
    }

    const rounds = state.rounds.slice();
    const recentRounds = rounds.slice(Math.max(0, rounds.length - this.config.recentWindowSize));
    const recentZeroCount = this.countZeros(recentRounds);

    const tableContextScore = this.readScore(input.tableContextScore, 0.5);
    const operatorReadinessScore = this.readScore(input.operatorReadinessScore, 0.5);
    const supervisionRiskScore = this.readScore(input.supervisionRiskScore, 0);

    const repeatReference = Math.max(
      Number.isInteger(state.repeatStreak) ? state.repeatStreak : 0,
      Number.isInteger(state.maxRepeatStreak) ? state.maxRepeatStreak : 0
    );

    const repeatPressure = this.clamp01(repeatReference / this.config.repeatPressureThreshold);
    const zeroPressure = this.clamp01(recentZeroCount / this.config.zeroPressureThreshold);
    const riskPressure = supervisionRiskScore;
    const operatorPressure = this.clamp01(1 - operatorReadinessScore);
    const tablePressure = this.clamp01(1 - tableContextScore);

    const livePressureScore = this.round4(
      repeatPressure * 0.22 +
      zeroPressure * 0.16 +
      riskPressure * 0.30 +
      operatorPressure * 0.18 +
      tablePressure * 0.14
    );

    const snapshotReasons = this.resolveReasons({
      repeatPressure,
      zeroPressure,
      riskPressure,
      operatorPressure,
      tablePressure
    });

    const pressureBand = this.resolvePressureBand(livePressureScore);
    const snapshotId = this.createSnapshotId(state.sessionId, state.totalRounds, state.lastNumber, livePressureScore);

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        snapshotId,
        sessionId: state.sessionId,
        totalRounds: state.totalRounds,
        lastNumber: state.lastNumber,
        uniqueNumbers: state.uniqueNumbers,
        zeroCount: state.zeroCount,
        recentZeroCount,
        repeatStreak: state.repeatStreak,
        maxRepeatStreak: state.maxRepeatStreak,
        tableContextScore,
        operatorReadinessScore,
        supervisionRiskScore,
        livePressureScore,
        pressureBand,
        reasons: Object.freeze(snapshotReasons),
        operationalGate: 'PAPER_AUTHORIZED',
        paperGate: 'PAPER_AUTHORIZED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  validateState(state, reasons) {
    if (typeof state.sessionId !== 'string' || state.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (!Array.isArray(state.rounds)) {
      reasons.push('rounds_not_array');
      return;
    }

    for (let index = 0; index < state.rounds.length; index += 1) {
      const value = state.rounds[index];

      if (!Number.isInteger(value) || value < 0 || value > 36) {
        reasons.push('roulette_number_out_of_range');
        return;
      }
    }

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

  resolveReasons(pressure) {
    const reasons = [];

    if (pressure.repeatPressure >= 1) {
      reasons.push('repeat_pressure_elevated');
    }

    if (pressure.zeroPressure >= 1) {
      reasons.push('recent_zero_pressure_elevated');
    }

    if (pressure.riskPressure >= 0.7) {
      reasons.push('supervision_risk_elevated');
    }

    if (pressure.operatorPressure >= 0.5) {
      reasons.push('operator_readiness_pressure');
    }

    if (pressure.tablePressure >= 0.5) {
      reasons.push('table_context_pressure');
    }

    return reasons;
  }

  countZeros(rounds) {
    let count = 0;

    for (let index = 0; index < rounds.length; index += 1) {
      if (rounds[index] === 0) {
        count += 1;
      }
    }

    return count;
  }

  resolvePressureBand(score) {
    if (score >= 0.82) {
      return 'CRITICAL';
    }

    if (score >= 0.62) {
      return 'PRESSURE';
    }

    if (score >= 0.38) {
      return 'WATCH';
    }

    return 'STABLE';
  }

  readScore(value, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return this.clamp01(value);
  }

  createSnapshotId(sessionId, totalRounds, lastNumber, livePressureScore) {
    let hash = 2166136261;
    const seed = `${sessionId}:${totalRounds}:${lastNumber}:${Math.round(livePressureScore * 10000)}`;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `live-snapshot-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  reject(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'live_context_snapshot_rejected',
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  clamp01(value) {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  assertValidConfig(config) {
    if (config.recentWindowSize < 1) {
      throw new Error('recentWindowSize must be greater than zero');
    }

    if (config.zeroPressureThreshold < 1) {
      throw new Error('zeroPressureThreshold must be greater than zero');
    }

    if (config.repeatPressureThreshold < 1) {
      throw new Error('repeatPressureThreshold must be greater than zero');
    }
  }
}

module.exports = {
  LiveContextSnapshotEngine
};
