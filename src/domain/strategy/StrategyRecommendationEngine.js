'use strict';

/**
 * Strategy Recommendation Engine.
 *
 * Converts strategy compatibility into a simple operator-facing recommendation:
 *
 * - EXECUTION_AUTHORIZED -> ENTRAR
 * - OBSERVE -> AGUARDAR
 * - BLOCKED / DO_NOT_USE -> NAO_UTILIZAR
 *
 * It never guarantees outcome, never suggests live money and never bypasses
 * supervisor veto, recovery, cooldown or institutional gates.
 */
class StrategyRecommendationEngine {
  constructor(config) {
    this.config = Object.freeze({
      minExecutionScore: Number.isFinite(config && config.minExecutionScore)
        ? Number(config.minExecutionScore)
        : 0.78,
      minObserveScore: Number.isFinite(config && config.minObserveScore)
        ? Number(config.minObserveScore)
        : 0.60
    });

    this.assertValidConfig(this.config);
  }

  recommend(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const compatibility = input.compatibilityDecision;

    if (!compatibility || typeof compatibility !== 'object') {
      return this.block(['missing_compatibility_decision']);
    }

    this.validateCompatibilityDecision(compatibility, reasons);

    const score = Number.isFinite(compatibility.compatibilityScore)
      ? this.clamp01(compatibility.compatibilityScore)
      : 0;

    if (input.supervisorVetoActive === true) {
      reasons.push('supervisor_veto_active');
    }

    if (input.sessionInterrupted === true) {
      reasons.push('paper_session_interrupted');
    }

    if (compatibility.status === 'BLOCKED') {
      reasons.push('strategy_compatibility_blocked');
    }

    if (compatibility.status === 'DO_NOT_USE') {
      reasons.push('strategy_not_compatible');
    }

    if (compatibility.status === 'OBSERVE') {
      reasons.push('strategy_observable_only');
    }

    if (compatibility.status === 'PAPER_COMPATIBLE' && compatibility.compatible === true && score >= this.config.minExecutionScore && reasons.length === 0) {
      return this.authorize(compatibility, score);
    }

    if (compatibility.status === 'OBSERVE' && score >= this.config.minObserveScore && this.hasHardBlock(reasons) === false) {
      return this.observe(compatibility, score, reasons);
    }

    return this.doNotUse(compatibility, score, reasons);
  }

  authorize(compatibility, score) {
    return Object.freeze({
      status: 'EXECUTION_AUTHORIZED',
      strategyId: compatibility.strategyId,
      operatorAction: 'ENTRAR',
      userAction: 'ENTRAR',
      recommendationScore: this.round4(score),
      message: 'Estratégia compatível em PAPER. Execução autorizada somente em ambiente PAPER.',
      reasons: Object.freeze(['strategy_paper_compatible']),
      strategyGate: 'EXECUTION_AUTHORIZED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  observe(compatibility, score, reasons) {
    return Object.freeze({
      status: 'OBSERVE',
      strategyId: compatibility.strategyId,
      operatorAction: 'AGUARDAR',
      userAction: 'AGUARDAR',
      recommendationScore: this.round4(score),
      message: 'Estratégia em observação. Aguardar nova confirmação contextual.',
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'OBSERVE',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  doNotUse(compatibility, score, reasons) {
    return Object.freeze({
      status: 'DO_NOT_USE',
      strategyId: compatibility.strategyId || 'UNKNOWN',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      recommendationScore: this.round4(score),
      message: 'Estratégia não autorizada no contexto atual.',
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  block(reasons) {
    return Object.freeze({
      status: 'BLOCKED',
      strategyId: 'UNKNOWN',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      recommendationScore: 0,
      message: 'Recomendação bloqueada por proteção institucional.',
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateCompatibilityDecision(compatibility, reasons) {
    if (typeof compatibility.strategyId !== 'string' || compatibility.strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (!Number.isFinite(compatibility.compatibilityScore) || compatibility.compatibilityScore < 0 || compatibility.compatibilityScore > 1) {
      reasons.push('invalid_compatibility_score');
    }

    if (compatibility.liveGate !== 'BLOCKED') {
      reasons.push('compatibility_live_gate_must_remain_blocked');
    }

    if (compatibility.productionMoneyAllowed !== false) {
      reasons.push('compatibility_production_money_must_remain_disabled');
    }

    if (compatibility.liveMoneyAuthorized !== false) {
      reasons.push('compatibility_live_money_must_remain_disabled');
    }
  }

  hasHardBlock(reasons) {
    const hard = [
      'supervisor_veto_active',
      'paper_session_interrupted',
      'strategy_compatibility_blocked',
      'compatibility_live_gate_must_remain_blocked',
      'compatibility_production_money_must_remain_disabled',
      'compatibility_live_money_must_remain_disabled',
      'missing_strategy_id',
      'invalid_compatibility_score'
    ];

    for (let index = 0; index < hard.length; index += 1) {
      if (reasons.includes(hard[index])) {
        return true;
      }
    }

    return false;
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
    if (config.minObserveScore < 0 || config.minObserveScore > 1) {
      throw new Error('minObserveScore must be between 0 and 1');
    }

    if (config.minExecutionScore < config.minObserveScore || config.minExecutionScore > 1) {
      throw new Error('minExecutionScore must be >= minObserveScore and <= 1');
    }
  }
}

module.exports = {
  StrategyRecommendationEngine
};
