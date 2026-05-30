'use strict';

/**
 * Detects institutional live risk escalation during a PAPER session.
 *
 * This engine does not veto by itself. It produces an escalation state that the
 * future LiveVetoEngine will consume. It never enables live money.
 */
class LiveRiskEscalationEngine {
  constructor(config) {
    this.config = Object.freeze({
      watchThreshold: Number.isFinite(config && config.watchThreshold) ? Number(config.watchThreshold) : 0.38,
      escalatedThreshold: Number.isFinite(config && config.escalatedThreshold) ? Number(config.escalatedThreshold) : 0.62,
      criticalThreshold: Number.isFinite(config && config.criticalThreshold) ? Number(config.criticalThreshold) : 0.82,
      maxPreviousEscalationCarry: Number.isFinite(config && config.maxPreviousEscalationCarry)
        ? Number(config.maxPreviousEscalationCarry)
        : 0.18
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const snapshot = input.snapshot;
    const consensus = input.consensus;

    if (!snapshot || typeof snapshot !== 'object') {
      return this.block(['missing_live_context_snapshot']);
    }

    if (!consensus || typeof consensus !== 'object') {
      return this.block(['missing_live_consensus']);
    }

    this.validateSnapshot(snapshot, reasons);
    this.validateConsensus(consensus, reasons);

    const livePressure = this.readScore(snapshot.livePressureScore, 1);
    const supervisionRisk = this.readScore(snapshot.supervisionRiskScore, 1);
    const consensusWeakness = this.clamp01(1 - this.readScore(consensus.consensusScore, 0));
    const operatorPressure = this.clamp01(1 - this.readScore(snapshot.operatorReadinessScore, 0));
    const tablePressure = this.clamp01(1 - this.readScore(snapshot.tableContextScore, 0));
    const previousCarry = this.resolvePreviousCarry(input.previousEscalation);

    if (snapshot.pressureBand === 'CRITICAL') {
      reasons.push('snapshot_pressure_critical');
    } else if (snapshot.pressureBand === 'PRESSURE') {
      reasons.push('snapshot_pressure_elevated');
    } else if (snapshot.pressureBand === 'WATCH') {
      reasons.push('snapshot_pressure_watch');
    }

    if (consensus.approved !== true || consensus.status !== 'LIVE_CONSENSUS_ACCEPTED') {
      reasons.push('live_consensus_not_accepted');
    }

    if (consensus.band === 'BLOCKED') {
      reasons.push('live_consensus_blocked');
    }

    if (livePressure >= 0.82) {
      reasons.push('live_pressure_critical');
    } else if (livePressure >= 0.62) {
      reasons.push('live_pressure_elevated');
    } else if (livePressure >= this.config.watchThreshold) {
      reasons.push('live_pressure_watch');
    }

    if (supervisionRisk >= 0.70) {
      reasons.push('supervision_risk_elevated');
    }

    if (operatorPressure >= 0.50) {
      reasons.push('operator_pressure_elevated');
    }

    if (tablePressure >= 0.50) {
      reasons.push('table_pressure_elevated');
    }

    if (previousCarry > 0) {
      reasons.push('previous_escalation_carry');
    }

    const escalationScore = this.round4(this.clamp01(
      livePressure * 0.30 +
      supervisionRisk * 0.24 +
      consensusWeakness * 0.22 +
      operatorPressure * 0.12 +
      tablePressure * 0.08 +
      previousCarry * 0.04
    ));

    const level = this.resolveLevel(escalationScore, reasons);
    const escalationActive = level === 'WATCH' || level === 'ESCALATED' || level === 'CRITICAL';

    return Object.freeze({
      status: escalationActive ? 'LIVE_RISK_ESCALATED' : 'LIVE_RISK_STABLE',
      escalationActive,
      level,
      escalationScore,
      reasons: Object.freeze(reasons.slice()),
      livePressureComponent: this.round4(livePressure),
      supervisionRiskComponent: this.round4(supervisionRisk),
      consensusWeaknessComponent: this.round4(consensusWeakness),
      operatorPressureComponent: this.round4(operatorPressure),
      tablePressureComponent: this.round4(tablePressure),
      previousCarryComponent: this.round4(previousCarry),
      snapshotId: snapshot.snapshotId || 'UNKNOWN',
      sessionId: snapshot.sessionId || 'UNKNOWN',
      operationalGate: level === 'CRITICAL' ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      paperGate: level === 'CRITICAL' ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateSnapshot(snapshot, reasons) {
    if (typeof snapshot.sessionId !== 'string' || snapshot.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (typeof snapshot.snapshotId !== 'string' || snapshot.snapshotId.length === 0) {
      reasons.push('missing_snapshot_id');
    }

    if (snapshot.operationalGate !== 'PAPER_AUTHORIZED') {
      reasons.push('snapshot_operational_gate_must_be_paper_authorized');
    }

    if (snapshot.paperGate !== 'PAPER_AUTHORIZED') {
      reasons.push('snapshot_paper_gate_must_be_paper_authorized');
    }

    if (snapshot.liveGate !== 'BLOCKED') {
      reasons.push('snapshot_live_gate_must_remain_blocked');
    }

    if (snapshot.productionMoneyAllowed !== false) {
      reasons.push('snapshot_production_money_must_remain_disabled');
    }

    if (snapshot.liveMoneyAuthorized !== false) {
      reasons.push('snapshot_live_money_must_remain_disabled');
    }

    const scores = [
      ['snapshot_table_context_score_invalid', snapshot.tableContextScore],
      ['snapshot_operator_readiness_score_invalid', snapshot.operatorReadinessScore],
      ['snapshot_supervision_risk_score_invalid', snapshot.supervisionRiskScore],
      ['snapshot_live_pressure_score_invalid', snapshot.livePressureScore]
    ];

    this.validateScoreList(scores, reasons);
  }

  validateConsensus(consensus, reasons) {
    if (consensus.liveGate !== 'BLOCKED') {
      reasons.push('consensus_live_gate_must_remain_blocked');
    }

    if (consensus.productionMoneyAllowed !== false) {
      reasons.push('consensus_production_money_must_remain_disabled');
    }

    if (consensus.liveMoneyAuthorized !== false) {
      reasons.push('consensus_live_money_must_remain_disabled');
    }

    if (!Number.isFinite(consensus.consensusScore) || consensus.consensusScore < 0 || consensus.consensusScore > 1) {
      reasons.push('consensus_score_invalid');
    }
  }

  validateScoreList(scores, reasons) {
    for (let index = 0; index < scores.length; index += 1) {
      const reason = scores[index][0];
      const value = scores[index][1];

      if (!Number.isFinite(value) || value < 0 || value > 1) {
        reasons.push(reason);
      }
    }
  }

  resolvePreviousCarry(previousEscalation) {
    if (!previousEscalation || typeof previousEscalation !== 'object') {
      return 0;
    }

    if (previousEscalation.level === 'CRITICAL') {
      return this.config.maxPreviousEscalationCarry;
    }

    if (previousEscalation.level === 'ESCALATED') {
      return this.config.maxPreviousEscalationCarry * 0.7;
    }

    if (previousEscalation.level === 'WATCH') {
      return this.config.maxPreviousEscalationCarry * 0.4;
    }

    return 0;
  }

  resolveLevel(score, reasons) {
    if (
      reasons.includes('snapshot_live_gate_must_remain_blocked') ||
      reasons.includes('snapshot_production_money_must_remain_disabled') ||
      reasons.includes('snapshot_live_money_must_remain_disabled') ||
      reasons.includes('consensus_live_gate_must_remain_blocked') ||
      reasons.includes('consensus_production_money_must_remain_disabled') ||
      reasons.includes('consensus_live_money_must_remain_disabled')
    ) {
      return 'CRITICAL';
    }

    if (
      score >= this.config.criticalThreshold ||
      reasons.includes('snapshot_pressure_critical') ||
      reasons.includes('live_pressure_critical') ||
      reasons.includes('live_consensus_blocked')
    ) {
      return 'CRITICAL';
    }

    if (
      score >= this.config.escalatedThreshold ||
      reasons.includes('snapshot_pressure_elevated') ||
      reasons.includes('live_pressure_elevated') ||
      reasons.includes('live_consensus_not_accepted')
    ) {
      return 'ESCALATED';
    }

    if (
      score >= this.config.watchThreshold ||
      reasons.includes('snapshot_pressure_watch') ||
      reasons.includes('live_pressure_watch') ||
      reasons.length > 0
    ) {
      return 'WATCH';
    }

    return 'NORMAL';
  }

  block(reasons) {
    return Object.freeze({
      status: 'LIVE_RISK_ESCALATED',
      escalationActive: true,
      level: 'CRITICAL',
      escalationScore: 1,
      reasons: Object.freeze(reasons.slice()),
      livePressureComponent: 0,
      supervisionRiskComponent: 0,
      consensusWeaknessComponent: 1,
      operatorPressureComponent: 0,
      tablePressureComponent: 0,
      previousCarryComponent: 0,
      snapshotId: 'UNKNOWN',
      sessionId: 'UNKNOWN',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
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
    if (
      config.watchThreshold < 0 ||
      config.escalatedThreshold < config.watchThreshold ||
      config.criticalThreshold < config.escalatedThreshold ||
      config.criticalThreshold > 1
    ) {
      throw new Error('risk escalation thresholds must be ordered within 0..1');
    }

    if (config.maxPreviousEscalationCarry < 0 || config.maxPreviousEscalationCarry > 1) {
      throw new Error('maxPreviousEscalationCarry must be between 0 and 1');
    }
  }
}

module.exports = {
  LiveRiskEscalationEngine
};
