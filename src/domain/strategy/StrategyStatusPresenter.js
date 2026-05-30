'use strict';

/**
 * Strategy Status Presenter.
 *
 * Converts institutional strategy explanation into an operator-facing status
 * card. It does not calculate compatibility, does not recommend by itself and
 * never enables live money.
 */
class StrategyStatusPresenter {
  present(input) {
    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const explanation = input.explanation;

    if (!explanation || typeof explanation !== 'object') {
      return this.block(['missing_strategy_explanation']);
    }

    const reasons = [];
    this.validateExplanation(explanation, reasons);

    if (reasons.length > 0) {
      return this.block(reasons, explanation.strategyId);
    }

    const statusView = this.resolveStatusView(explanation);
    const scorePercent = this.toPercent(explanation.recommendationScore);

    return Object.freeze({
      status: 'STRATEGY_STATUS_READY',
      strategyId: explanation.strategyId,
      title: this.resolveTitle(explanation.strategyId),
      displayStatus: statusView.displayStatus,
      displayAction: statusView.displayAction,
      actionPriority: statusView.actionPriority,
      scorePercent,
      severity: explanation.severity,
      summary: explanation.summary,
      operatorMessage: explanation.operatorMessage,
      reasons: Object.freeze(Array.isArray(explanation.reasons) ? explanation.reasons.slice() : []),
      auditTags: Object.freeze(Array.isArray(explanation.auditTags) ? explanation.auditTags.slice() : []),
      card: this.renderCard(explanation, statusView, scorePercent),
      strategyGate: explanation.strategyGate,
      operationalGate: explanation.operationalGate,
      paperGate: explanation.paperGate,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateExplanation(explanation, reasons) {
    if (typeof explanation.strategyId !== 'string' || explanation.strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (typeof explanation.recommendationStatus !== 'string' || explanation.recommendationStatus.length === 0) {
      reasons.push('missing_recommendation_status');
    }

    if (typeof explanation.operatorAction !== 'string' || explanation.operatorAction.length === 0) {
      reasons.push('missing_operator_action');
    }

    if (!Number.isFinite(explanation.recommendationScore) || explanation.recommendationScore < 0 || explanation.recommendationScore > 1) {
      reasons.push('invalid_recommendation_score');
    }

    if (explanation.liveGate !== 'BLOCKED') {
      reasons.push('explanation_live_gate_must_remain_blocked');
    }

    if (explanation.productionMoneyAllowed !== false) {
      reasons.push('explanation_production_money_must_remain_disabled');
    }

    if (explanation.liveMoneyAuthorized !== false) {
      reasons.push('explanation_live_money_must_remain_disabled');
    }
  }

  resolveStatusView(explanation) {
    if (explanation.recommendationStatus === 'EXECUTION_AUTHORIZED' && explanation.operatorAction === 'ENTRAR') {
      return Object.freeze({
        displayStatus: 'EXECUCAO_AUTORIZADA',
        displayAction: 'ENTRAR',
        actionPriority: 'HIGH'
      });
    }

    if (explanation.recommendationStatus === 'OBSERVE' || explanation.operatorAction === 'AGUARDAR') {
      return Object.freeze({
        displayStatus: 'OBSERVAR',
        displayAction: 'AGUARDAR',
        actionPriority: 'MEDIUM'
      });
    }

    return Object.freeze({
      displayStatus: 'BLOQUEADO',
      displayAction: 'NAO_UTILIZAR',
      actionPriority: 'BLOCKING'
    });
  }

  resolveTitle(strategyId) {
    return strategyId
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  renderCard(explanation, statusView, scorePercent) {
    const lines = [
      '================================',
      `Estratégia: ${this.resolveTitle(explanation.strategyId)}`,
      `Status: ${statusView.displayStatus}`,
      `Ação: ${statusView.displayAction}`,
      `Score: ${scorePercent}%`,
      `Severidade: ${explanation.severity}`,
      `Resumo: ${explanation.summary}`,
      `Mensagem: ${explanation.operatorMessage}`,
      'Live Money: BLOQUEADO',
      '================================'
    ];

    return lines.join('\n');
  }

  block(reasons, strategyId) {
    const safeStrategyId = strategyId || 'UNKNOWN';
    const title = safeStrategyId === 'UNKNOWN' ? 'UNKNOWN' : this.resolveTitle(safeStrategyId);

    return Object.freeze({
      status: 'STRATEGY_STATUS_BLOCKED',
      strategyId: safeStrategyId,
      title,
      displayStatus: 'BLOQUEADO',
      displayAction: 'NAO_UTILIZAR',
      actionPriority: 'BLOCKING',
      scorePercent: 0,
      severity: 'CRITICAL',
      summary: 'Status bloqueado por proteção institucional.',
      operatorMessage: 'NÃO UTILIZAR.',
      reasons: Object.freeze(reasons.slice()),
      auditTags: Object.freeze(['strategy_status_presenter', 'blocked']),
      card: [
        '================================',
        `Estratégia: ${title}`,
        'Status: BLOQUEADO',
        'Ação: NAO_UTILIZAR',
        'Score: 0%',
        'Severidade: CRITICAL',
        'Resumo: Status bloqueado por proteção institucional.',
        'Mensagem: NÃO UTILIZAR.',
        'Live Money: BLOQUEADO',
        '================================'
      ].join('\n'),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  toPercent(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (value <= 0) {
      return 0;
    }

    if (value >= 1) {
      return 100;
    }

    return Math.round(value * 100);
  }
}

module.exports = {
  StrategyStatusPresenter
};
