'use strict';

/**
 * Institutional live veto engine.
 *
 * Converts critical live risk escalation into a hard PAPER session interruption.
 * It never suggests entries, never authorizes live money and always forces all
 * gates to BLOCKED whenever a veto is active.
 */
class LiveVetoEngine {
  constructor(config) {
    this.config = Object.freeze({
      criticalVetoThreshold: Number.isFinite(config && config.criticalVetoThreshold)
        ? Number(config.criticalVetoThreshold)
        : 0.82,
      escalatedWatchThreshold: Number.isFinite(config && config.escalatedWatchThreshold)
        ? Number(config.escalatedWatchThreshold)
        : 0.62
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.veto(['input_not_object'], 1);
    }

    const riskEscalation = input.riskEscalation;

    if (!riskEscalation || typeof riskEscalation !== 'object') {
      return this.veto(['missing_risk_escalation'], 1);
    }

    this.validateRiskEscalation(riskEscalation, reasons);

    const escalationScore = this.readScore(riskEscalation.escalationScore, 1);
    const level = typeof riskEscalation.level === 'string' ? riskEscalation.level : 'CRITICAL';

    if (level === 'CRITICAL') {
      reasons.push('critical_risk_level');
    }

    if (escalationScore >= this.config.criticalVetoThreshold) {
      reasons.push('critical_escalation_score');
    }

    if (Array.isArray(riskEscalation.reasons)) {
      if (riskEscalation.reasons.includes('live_consensus_blocked')) {
        reasons.push('live_consensus_blocked');
      }

      if (riskEscalation.reasons.includes('snapshot_pressure_critical')) {
        reasons.push('snapshot_pressure_critical');
      }

      if (riskEscalation.reasons.includes('live_pressure_critical')) {
        reasons.push('live_pressure_critical');
      }

      if (riskEscalation.reasons.includes('snapshot_live_gate_must_remain_blocked')) {
        reasons.push('live_gate_invariant_violation');
      }

      if (riskEscalation.reasons.includes('snapshot_production_money_must_remain_disabled')) {
        reasons.push('production_money_invariant_violation');
      }

      if (riskEscalation.reasons.includes('snapshot_live_money_must_remain_disabled')) {
        reasons.push('live_money_invariant_violation');
      }
    }

    if (input.manualOverrideRequested === true) {
      reasons.push('manual_override_rejected');
    }

    const mustVeto = this.mustVeto(level, escalationScore, reasons);

    if (mustVeto) {
      return this.veto(reasons, escalationScore);
    }

    const monitoringReasons = [];

    if (level === 'ESCALATED' || escalationScore >= this.config.escalatedWatchThreshold) {
      monitoringReasons.push('elevated_monitoring_required');
    }

    if (level === 'WATCH') {
      monitoringReasons.push('watch_monitoring_required');
    }

    return Object.freeze({
      status: 'LIVE_VETO_CLEAR',
      vetoActive: false,
      shouldInterruptSession: false,
      canContinuePaperSession: true,
      vetoScore: this.round4(escalationScore),
      reasons: Object.freeze(monitoringReasons),
      riskLevel: level,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  mustVeto(level, escalationScore, reasons) {
    if (level === 'CRITICAL') {
      return true;
    }

    if (escalationScore >= this.config.criticalVetoThreshold) {
      return true;
    }

    const hardReasons = [
      'critical_risk_level',
      'critical_escalation_score',
      'live_consensus_blocked',
      'snapshot_pressure_critical',
      'live_pressure_critical',
      'live_gate_invariant_violation',
      'production_money_invariant_violation',
      'live_money_invariant_violation',
      'risk_live_gate_must_remain_blocked',
      'risk_production_money_must_remain_disabled',
      'risk_live_money_must_remain_disabled',
      'manual_override_rejected',
      'invalid_risk_level'
    ];

    for (let index = 0; index < hardReasons.length; index += 1) {
      if (reasons.includes(hardReasons[index])) {
        return true;
      }
    }

    return false;
  }

  validateRiskEscalation(riskEscalation, reasons) {
    const validLevels = ['NORMAL', 'WATCH', 'ESCALATED', 'CRITICAL'];

    if (!validLevels.includes(riskEscalation.level)) {
      reasons.push('invalid_risk_level');
    }

    if (!Number.isFinite(riskEscalation.escalationScore) || riskEscalation.escalationScore < 0 || riskEscalation.escalationScore > 1) {
      reasons.push('invalid_escalation_score');
    }

    if (riskEscalation.liveGate !== 'BLOCKED') {
      reasons.push('risk_live_gate_must_remain_blocked');
    }

    if (riskEscalation.productionMoneyAllowed !== false) {
      reasons.push('risk_production_money_must_remain_disabled');
    }

    if (riskEscalation.liveMoneyAuthorized !== false) {
      reasons.push('risk_live_money_must_remain_disabled');
    }
  }

  veto(reasons, vetoScore) {
    return Object.freeze({
      status: 'LIVE_VETO_ACTIVE',
      vetoActive: true,
      shouldInterruptSession: true,
      canContinuePaperSession: false,
      vetoScore: this.round4(this.clamp01(vetoScore)),
      reasons: Object.freeze(this.unique(reasons)),
      riskLevel: 'CRITICAL',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  unique(values) {
    const seen = new Set();
    const result = [];

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }

    return result;
  }

  readScore(value, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return this.clamp01(value);
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
    if (config.escalatedWatchThreshold < 0 || config.escalatedWatchThreshold > 1) {
      throw new Error('escalatedWatchThreshold must be between 0 and 1');
    }

    if (config.criticalVetoThreshold < config.escalatedWatchThreshold || config.criticalVetoThreshold > 1) {
      throw new Error('criticalVetoThreshold must be >= escalatedWatchThreshold and <= 1');
    }
  }
}

module.exports = {
  LiveVetoEngine
};
