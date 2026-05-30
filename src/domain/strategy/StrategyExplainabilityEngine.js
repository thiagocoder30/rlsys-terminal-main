'use strict';

/**
 * Strategy Explainability Engine.
 *
 * Turns a strategy recommendation into a clear institutional explanation for
 * the operator. It does not change the recommendation and never authorizes
 * live money.
 */
class StrategyExplainabilityEngine {
  explain(input) {
    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const recommendation = input.recommendation;

    if (!recommendation || typeof recommendation !== 'object') {
      return this.block(['missing_strategy_recommendation']);
    }

    const reasons = [];
    this.validateRecommendation(recommendation, reasons);

    if (reasons.length > 0) {
      return this.block(reasons, recommendation.strategyId);
    }

    const status = recommendation.status;
    const score = Number.isFinite(recommendation.recommendationScore)
      ? this.clamp01(recommendation.recommendationScore)
      : 0;

    const explanationReasons = this.resolveExplanationReasons(recommendation, input);
    const severity = this.resolveSeverity(status);
    const summary = this.resolveSummary(recommendation, score);
    const operatorMessage = this.resolveOperatorMessage(recommendation);

    return Object.freeze({
      status: 'STRATEGY_EXPLANATION_READY',
      strategyId: recommendation.strategyId,
      recommendationStatus: recommendation.status,
      operatorAction: recommendation.operatorAction,
      userAction: recommendation.userAction,
      severity,
      summary,
      operatorMessage,
      recommendationScore: this.round4(score),
      reasons: Object.freeze(explanationReasons),
      auditTags: Object.freeze(this.resolveAuditTags(recommendation, explanationReasons)),
      strategyGate: recommendation.strategyGate,
      operationalGate: recommendation.operationalGate,
      paperGate: recommendation.paperGate,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateRecommendation(recommendation, reasons) {
    if (typeof recommendation.strategyId !== 'string' || recommendation.strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (typeof recommendation.status !== 'string' || recommendation.status.length === 0) {
      reasons.push('missing_recommendation_status');
    }

    if (typeof recommendation.operatorAction !== 'string' || recommendation.operatorAction.length === 0) {
      reasons.push('missing_operator_action');
    }

    if (!Number.isFinite(recommendation.recommendationScore) || recommendation.recommendationScore < 0 || recommendation.recommendationScore > 1) {
      reasons.push('invalid_recommendation_score');
    }

    if (recommendation.liveGate !== 'BLOCKED') {
      reasons.push('recommendation_live_gate_must_remain_blocked');
    }

    if (recommendation.productionMoneyAllowed !== false) {
      reasons.push('recommendation_production_money_must_remain_disabled');
    }

    if (recommendation.liveMoneyAuthorized !== false) {
      reasons.push('recommendation_live_money_must_remain_disabled');
    }
  }

  resolveExplanationReasons(recommendation, input) {
    const reasons = Array.isArray(recommendation.reasons) ? recommendation.reasons.slice() : [];

    if (recommendation.status === 'EXECUTION_AUTHORIZED') {
      reasons.push('paper_execution_authorized_by_strategy_context');
      reasons.push('live_money_remains_blocked');
    }

    if (recommendation.status === 'OBSERVE') {
      reasons.push('strategy_requires_more_context_confirmation');
    }

    if (recommendation.status === 'DO_NOT_USE' || recommendation.status === 'BLOCKED') {
      reasons.push('strategy_not_authorized_in_current_context');
    }

    if (input && input.cooldownActive === true) {
      reasons.push('strategy_cooldown_context_present');
    }

    if (input && input.sessionRiskElevated === true) {
      reasons.push('session_risk_context_present');
    }

    return this.unique(reasons);
  }

  resolveSeverity(status) {
    if (status === 'EXECUTION_AUTHORIZED') {
      return 'INFO';
    }

    if (status === 'OBSERVE') {
      return 'WARNING';
    }

    return 'CRITICAL';
  }

  resolveSummary(recommendation, score) {
    if (recommendation.status === 'EXECUTION_AUTHORIZED') {
      return `${recommendation.strategyId}: execução PAPER autorizada com score ${this.round4(score)}.`;
    }

    if (recommendation.status === 'OBSERVE') {
      return `${recommendation.strategyId}: observar e aguardar nova confirmação contextual.`;
    }

    return `${recommendation.strategyId}: estratégia não autorizada no contexto atual.`;
  }

  resolveOperatorMessage(recommendation) {
    if (recommendation.status === 'EXECUTION_AUTHORIZED') {
      return 'ENTRAR somente em PAPER. Dinheiro real permanece bloqueado.';
    }

    if (recommendation.status === 'OBSERVE') {
      return 'AGUARDAR. Ainda não há autorização institucional para execução.';
    }

    return 'NÃO UTILIZAR. Estratégia bloqueada ou incompatível.';
  }

  resolveAuditTags(recommendation, reasons) {
    const tags = ['strategy_explainability'];

    if (recommendation.status === 'EXECUTION_AUTHORIZED') {
      tags.push('paper_execution_authorized');
    } else if (recommendation.status === 'OBSERVE') {
      tags.push('observe_only');
    } else {
      tags.push('strategy_blocked');
    }

    if (reasons.includes('live_money_remains_blocked')) {
      tags.push('live_money_blocked');
    }

    return this.unique(tags);
  }

  block(reasons, strategyId) {
    return Object.freeze({
      status: 'STRATEGY_EXPLANATION_BLOCKED',
      strategyId: strategyId || 'UNKNOWN',
      recommendationStatus: 'BLOCKED',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      severity: 'CRITICAL',
      summary: 'Explicação bloqueada por proteção institucional.',
      operatorMessage: 'NÃO UTILIZAR.',
      recommendationScore: 0,
      reasons: Object.freeze(reasons.slice()),
      auditTags: Object.freeze(['strategy_explainability', 'blocked']),
      strategyGate: 'BLOCKED',
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
}

module.exports = {
  StrategyExplainabilityEngine
};
