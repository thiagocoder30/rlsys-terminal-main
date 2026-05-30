'use strict';

/**
 * Builds institutional live consensus from a LiveContextSnapshot.
 *
 * Any institutional violation blocks the live consensus immediately.
 * This engine never suggests entries and never enables live money.
 */
class LiveConsensusEngine {
  constructor(config) {
    this.config = Object.freeze({
      strongThreshold: Number.isFinite(config && config.strongThreshold) ? Number(config.strongThreshold) : 0.78,
      acceptableThreshold: Number.isFinite(config && config.acceptableThreshold) ? Number(config.acceptableThreshold) : 0.64,
      weakThreshold: Number.isFinite(config && config.weakThreshold) ? Number(config.weakThreshold) : 0.45,
      maxAllowedPressureScore: Number.isFinite(config && config.maxAllowedPressureScore) ? Number(config.maxAllowedPressureScore) : 0.81
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const snapshot = input.snapshot;

    if (!snapshot || typeof snapshot !== 'object') {
      return this.block(['missing_live_context_snapshot']);
    }

    this.validateSnapshot(snapshot, reasons);

    const tableComponent = this.readScore(snapshot.tableContextScore, 0);
    const operatorComponent = this.readScore(snapshot.operatorReadinessScore, 0);
    const riskComponent = this.clamp01(1 - this.readScore(snapshot.supervisionRiskScore, 1));
    const stabilityComponent = this.clamp01(1 - this.readScore(snapshot.livePressureScore, 1));

    if (snapshot.pressureBand === 'CRITICAL') {
      reasons.push('critical_live_pressure');
    }

    if (snapshot.livePressureScore > this.config.maxAllowedPressureScore) {
      reasons.push('live_pressure_above_limit');
    }

    if (tableComponent < 0.5) {
      reasons.push('table_context_weak');
    }

    if (operatorComponent < 0.5) {
      reasons.push('operator_readiness_weak');
    }

    if (riskComponent < 0.5) {
      reasons.push('supervision_risk_high');
    }

    const consensusScore = this.round4(
      tableComponent * 0.28 +
      operatorComponent * 0.24 +
      riskComponent * 0.24 +
      stabilityComponent * 0.24
    );

    const band = this.resolveBand(consensusScore, reasons);
    const approved = band === 'STRONG' || band === 'ACCEPTABLE';

    return Object.freeze({
      status: approved ? 'LIVE_CONSENSUS_ACCEPTED' : 'LIVE_CONSENSUS_BLOCKED',
      approved,
      consensusScore,
      band,
      reasons: Object.freeze(reasons.slice()),
      tableComponent: this.round4(tableComponent),
      operatorComponent: this.round4(operatorComponent),
      riskComponent: this.round4(riskComponent),
      stabilityComponent: this.round4(stabilityComponent),
      snapshotId: snapshot.snapshotId || 'UNKNOWN',
      sessionId: snapshot.sessionId || 'UNKNOWN',
      operationalGate: approved ? 'PAPER_AUTHORIZED' : 'BLOCKED',
      paperGate: approved ? 'PAPER_AUTHORIZED' : 'BLOCKED',
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
      reasons.push('operational_gate_must_be_paper_authorized');
    }

    if (snapshot.paperGate !== 'PAPER_AUTHORIZED') {
      reasons.push('paper_gate_must_be_paper_authorized');
    }

    if (snapshot.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    if (snapshot.productionMoneyAllowed !== false) {
      reasons.push('production_money_must_remain_disabled');
    }

    if (snapshot.liveMoneyAuthorized !== false) {
      reasons.push('live_money_must_remain_disabled');
    }

    const requiredScores = [
      ['tableContextScore', snapshot.tableContextScore],
      ['operatorReadinessScore', snapshot.operatorReadinessScore],
      ['supervisionRiskScore', snapshot.supervisionRiskScore],
      ['livePressureScore', snapshot.livePressureScore]
    ];

    for (let index = 0; index < requiredScores.length; index += 1) {
      const name = requiredScores[index][0];
      const value = requiredScores[index][1];

      if (!Number.isFinite(value) || value < 0 || value > 1) {
        reasons.push(`${name}_invalid`);
      }
    }
  }

  resolveBand(score, reasons) {
    if (reasons.length > 0) {
      return 'BLOCKED';
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

    return 'BLOCKED';
  }

  block(reasons) {
    return Object.freeze({
      status: 'LIVE_CONSENSUS_BLOCKED',
      approved: false,
      consensusScore: 0,
      band: 'BLOCKED',
      reasons: Object.freeze(reasons.slice()),
      tableComponent: 0,
      operatorComponent: 0,
      riskComponent: 0,
      stabilityComponent: 0,
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
      config.weakThreshold < 0 ||
      config.acceptableThreshold < config.weakThreshold ||
      config.strongThreshold < config.acceptableThreshold ||
      config.strongThreshold > 1
    ) {
      throw new Error('consensus thresholds must be ordered within 0..1');
    }

    if (config.maxAllowedPressureScore < 0 || config.maxAllowedPressureScore > 1) {
      throw new Error('maxAllowedPressureScore must be between 0 and 1');
    }
  }
}

module.exports = {
  LiveConsensusEngine
};
