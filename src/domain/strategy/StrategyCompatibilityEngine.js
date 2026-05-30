'use strict';

/**
 * Strategy Compatibility Engine.
 *
 * Calculates whether a registered strategy is contextually compatible with the
 * current PAPER session. It consumes recovery/cooldown status and live context
 * scores, but does not recommend entry by itself.
 */
class StrategyCompatibilityEngine {
  constructor(config) {
    this.config = Object.freeze({
      compatibleThreshold: Number.isFinite(config && config.compatibleThreshold)
        ? Number(config.compatibleThreshold)
        : 0.78,
      observableThreshold: Number.isFinite(config && config.observableThreshold)
        ? Number(config.observableThreshold)
        : 0.60,
      minimumRecoveryRequired: config && config.minimumRecoveryRequired === false ? false : true
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const strategyId = typeof input.strategyId === 'string' && input.strategyId.trim().length > 0
      ? input.strategyId.trim()
      : '';

    if (strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    const recoveryDecision = input.recoveryDecision;

    if (!recoveryDecision || typeof recoveryDecision !== 'object') {
      reasons.push('missing_recovery_decision');
    } else {
      this.validateRecoveryDecision(recoveryDecision, reasons);
    }

    const tableContextScore = this.readScore(input.tableContextScore, 0);
    const operatorReadinessScore = this.readScore(input.operatorReadinessScore, 0);
    const liveConsensusScore = this.readScore(input.liveConsensusScore, 0);
    const riskScore = this.readScore(input.riskScore, 1);
    const strategyDoctrineScore = this.readScore(input.strategyDoctrineScore, 0);
    const memoryTrustScore = this.readScore(input.memoryTrustScore, 0.5);

    if (input.supervisorVetoActive === true) {
      reasons.push('supervisor_veto_active');
    }

    if (riskScore > 0.34) {
      reasons.push('risk_above_strategy_limit');
    }

    if (this.config.minimumRecoveryRequired && recoveryDecision && recoveryDecision.strategyAvailableForEvaluation !== true) {
      reasons.push('strategy_not_recovered_for_evaluation');
    }

    if (recoveryDecision && recoveryDecision.strategyGate === 'BLOCKED') {
      reasons.push('strategy_recovery_blocked');
    }

    const safetyComponent = this.clamp01(1 - riskScore);

    const compatibilityScore = this.round4(
      tableContextScore * 0.24 +
      operatorReadinessScore * 0.20 +
      liveConsensusScore * 0.22 +
      safetyComponent * 0.16 +
      strategyDoctrineScore * 0.14 +
      memoryTrustScore * 0.04
    );

    const status = this.resolveStatus(compatibilityScore, reasons);
    const compatible = status === 'PAPER_COMPATIBLE';

    return Object.freeze({
      status,
      compatible,
      strategyId: strategyId || 'UNKNOWN',
      compatibilityScore,
      tableComponent: this.round4(tableContextScore),
      operatorComponent: this.round4(operatorReadinessScore),
      consensusComponent: this.round4(liveConsensusScore),
      safetyComponent: this.round4(safetyComponent),
      doctrineComponent: this.round4(strategyDoctrineScore),
      memoryTrustComponent: this.round4(memoryTrustScore),
      reasons: Object.freeze(reasons.slice()),
      action: this.resolveAction(status),
      strategyGate: compatible ? 'COMPATIBLE' : status,
      operationalGate: compatible ? 'PAPER_AUTHORIZED' : 'PAPER_AUTHORIZED',
      paperGate: compatible ? 'PAPER_AUTHORIZED' : 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateRecoveryDecision(decision, reasons) {
    if (decision.liveGate !== 'BLOCKED') {
      reasons.push('recovery_live_gate_must_remain_blocked');
    }

    if (decision.productionMoneyAllowed !== false) {
      reasons.push('recovery_production_money_must_remain_disabled');
    }

    if (decision.liveMoneyAuthorized !== false) {
      reasons.push('recovery_live_money_must_remain_disabled');
    }
  }

  resolveStatus(score, reasons) {
    const hardBlockReasons = [
      'input_not_object',
      'missing_strategy_id',
      'missing_recovery_decision',
      'supervisor_veto_active',
      'risk_above_strategy_limit',
      'strategy_not_recovered_for_evaluation',
      'strategy_recovery_blocked',
      'recovery_live_gate_must_remain_blocked',
      'recovery_production_money_must_remain_disabled',
      'recovery_live_money_must_remain_disabled'
    ];

    for (let index = 0; index < hardBlockReasons.length; index += 1) {
      if (reasons.includes(hardBlockReasons[index])) {
        return 'BLOCKED';
      }
    }

    if (score >= this.config.compatibleThreshold) {
      return 'PAPER_COMPATIBLE';
    }

    if (score >= this.config.observableThreshold) {
      return 'OBSERVE';
    }

    return 'DO_NOT_USE';
  }

  resolveAction(status) {
    if (status === 'PAPER_COMPATIBLE') {
      return 'ALLOW_PAPER_EVALUATION';
    }

    if (status === 'OBSERVE') {
      return 'WAIT';
    }

    if (status === 'DO_NOT_USE') {
      return 'DO_NOT_USE';
    }

    return 'DO_NOT_USE';
  }

  block(reasons) {
    return Object.freeze({
      status: 'BLOCKED',
      compatible: false,
      strategyId: 'UNKNOWN',
      compatibilityScore: 0,
      tableComponent: 0,
      operatorComponent: 0,
      consensusComponent: 0,
      safetyComponent: 0,
      doctrineComponent: 0,
      memoryTrustComponent: 0,
      reasons: Object.freeze(reasons.slice()),
      action: 'DO_NOT_USE',
      strategyGate: 'BLOCKED',
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
    if (config.observableThreshold < 0 || config.observableThreshold > 1) {
      throw new Error('observableThreshold must be between 0 and 1');
    }

    if (config.compatibleThreshold < config.observableThreshold || config.compatibleThreshold > 1) {
      throw new Error('compatibleThreshold must be >= observableThreshold and <= 1');
    }
  }
}

module.exports = {
  StrategyCompatibilityEngine
};
