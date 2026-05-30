'use strict';

/**
 * Strategy Recovery Engine.
 *
 * Decides when a strategy can leave COOLDOWN / REVIEW_REQUIRED and return to
 * compatibility evaluation. It does not authorize entry by itself.
 *
 * Pipeline:
 * Result Ledger -> Cooldown -> Recovery -> Compatibility -> Recommendation.
 */
class StrategyRecoveryEngine {
  constructor(config) {
    this.config = Object.freeze({
      minRecoveryContextScore: Number.isFinite(config && config.minRecoveryContextScore)
        ? Number(config.minRecoveryContextScore)
        : 0.68,
      maxAllowedRiskScore: Number.isFinite(config && config.maxAllowedRiskScore)
        ? Number(config.maxAllowedRiskScore)
        : 0.34
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const ledger = input.ledger;
    const cooldownDecision = input.cooldownDecision;

    if (!ledger || typeof ledger !== 'object') {
      return this.block(['missing_strategy_ledger']);
    }

    if (!cooldownDecision || typeof cooldownDecision !== 'object') {
      return this.block(['missing_cooldown_decision']);
    }

    this.validateLedger(ledger, reasons);
    this.validateCooldownDecision(cooldownDecision, reasons);

    const contextRecoveryScore = this.readScore(input.contextRecoveryScore, 0);
    const riskScore = this.readScore(input.riskScore, 1);

    if (input.supervisorVetoActive === true) {
      reasons.push('supervisor_veto_active');
    }

    if (riskScore > this.config.maxAllowedRiskScore) {
      reasons.push('risk_above_recovery_limit');
    }

    if (reasons.length > 0) {
      return this.block(reasons, ledger);
    }

    if (cooldownDecision.status === 'STRATEGY_BLOCKED') {
      return this.block(['strategy_cooldown_hard_block'], ledger);
    }

    if (cooldownDecision.status === 'STRATEGY_COOLDOWN') {
      return this.waitCooldown(['strategy_cooldown_still_active'], ledger, cooldownDecision);
    }

    if (cooldownDecision.status === 'STRATEGY_REVIEW_REQUIRED') {
      if (contextRecoveryScore < this.config.minRecoveryContextScore) {
        return this.waitRecovery(['context_recovery_below_minimum'], ledger, cooldownDecision, contextRecoveryScore, riskScore);
      }

      return this.approveRecovery(['strategy_recovery_context_approved'], ledger, cooldownDecision, contextRecoveryScore, riskScore);
    }

    if (cooldownDecision.status === 'STRATEGY_AVAILABLE') {
      return this.approveRecovery(['strategy_already_available'], ledger, cooldownDecision, contextRecoveryScore, riskScore);
    }

    return this.block(['unknown_cooldown_status'], ledger);
  }

  approveRecovery(reasons, ledger, cooldownDecision, contextRecoveryScore, riskScore) {
    return Object.freeze({
      status: 'STRATEGY_RECOVERY_APPROVED',
      strategyRecovered: true,
      strategyAvailableForEvaluation: true,
      action: 'ALLOW_STRATEGY_REEVALUATION',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      contextRecoveryScore: this.round4(contextRecoveryScore),
      riskScore: this.round4(riskScore),
      remainingRounds: 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'RECOVERED',
      previousStrategyGate: cooldownDecision.strategyGate || 'UNKNOWN',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  waitCooldown(reasons, ledger, cooldownDecision) {
    return Object.freeze({
      status: 'STRATEGY_RECOVERY_WAIT_COOLDOWN',
      strategyRecovered: false,
      strategyAvailableForEvaluation: false,
      action: 'WAIT_COOLDOWN',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      contextRecoveryScore: 0,
      riskScore: 0,
      remainingRounds: Number.isInteger(cooldownDecision.remainingRounds) ? cooldownDecision.remainingRounds : 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'COOLDOWN',
      previousStrategyGate: cooldownDecision.strategyGate || 'COOLDOWN',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  waitRecovery(reasons, ledger, cooldownDecision, contextRecoveryScore, riskScore) {
    return Object.freeze({
      status: 'STRATEGY_RECOVERY_WAIT_CONTEXT',
      strategyRecovered: false,
      strategyAvailableForEvaluation: false,
      action: 'WAIT_FOR_RECOVERY',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      contextRecoveryScore: this.round4(contextRecoveryScore),
      riskScore: this.round4(riskScore),
      remainingRounds: 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'REVIEW_REQUIRED',
      previousStrategyGate: cooldownDecision.strategyGate || 'REVIEW_REQUIRED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  block(reasons, ledger) {
    return Object.freeze({
      status: 'STRATEGY_RECOVERY_BLOCKED',
      strategyRecovered: false,
      strategyAvailableForEvaluation: false,
      action: 'DO_NOT_USE',
      strategyId: ledger && ledger.strategyId ? ledger.strategyId : 'UNKNOWN',
      sessionId: ledger && ledger.sessionId ? ledger.sessionId : 'UNKNOWN',
      contextRecoveryScore: 0,
      riskScore: 1,
      remainingRounds: 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      previousStrategyGate: 'UNKNOWN',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateLedger(ledger, reasons) {
    if (typeof ledger.strategyId !== 'string' || ledger.strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (typeof ledger.sessionId !== 'string' || ledger.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (!Array.isArray(ledger.entries)) {
      reasons.push('ledger_entries_not_array');
    }

    if (ledger.liveGate !== 'BLOCKED') {
      reasons.push('ledger_live_gate_must_remain_blocked');
    }

    if (ledger.productionMoneyAllowed !== false) {
      reasons.push('ledger_production_money_must_remain_disabled');
    }

    if (ledger.liveMoneyAuthorized !== false) {
      reasons.push('ledger_live_money_must_remain_disabled');
    }
  }

  validateCooldownDecision(decision, reasons) {
    if (decision.liveGate !== 'BLOCKED') {
      reasons.push('cooldown_live_gate_must_remain_blocked');
    }

    if (decision.productionMoneyAllowed !== false) {
      reasons.push('cooldown_production_money_must_remain_disabled');
    }

    if (decision.liveMoneyAuthorized !== false) {
      reasons.push('cooldown_live_money_must_remain_disabled');
    }
  }

  readScore(value, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

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
    if (config.minRecoveryContextScore < 0 || config.minRecoveryContextScore > 1) {
      throw new Error('minRecoveryContextScore must be between 0 and 1');
    }

    if (config.maxAllowedRiskScore < 0 || config.maxAllowedRiskScore > 1) {
      throw new Error('maxAllowedRiskScore must be between 0 and 1');
    }
  }
}

module.exports = {
  StrategyRecoveryEngine
};
