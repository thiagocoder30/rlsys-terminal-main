'use strict';

/**
 * Operator Action Center.
 *
 * Converts the StrategyDashboardEngine output into one centralized operator
 * decision for the current PAPER round:
 *
 * - ENTRAR
 * - AGUARDAR
 * - NAO_UTILIZAR
 *
 * It never places bets, never bypasses gates and never enables live money.
 */
class OperatorActionCenter {
  decide(input) {
    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const dashboard = input.dashboard;

    if (!dashboard || typeof dashboard !== 'object') {
      return this.block(['missing_strategy_dashboard']);
    }

    const reasons = [];
    this.validateDashboard(dashboard, reasons);

    if (input.supervisorVetoActive === true) {
      reasons.push('supervisor_veto_active');
    }

    if (input.sessionInterrupted === true) {
      reasons.push('paper_session_interrupted');
    }

    if (reasons.length > 0) {
      return this.block(reasons);
    }

    if (dashboard.sessionStatus === 'SESSION_BLOCKED') {
      return this.block(['dashboard_session_blocked']);
    }

    const topCard = this.resolveTopCard(dashboard.cards);

    if (!topCard) {
      return this.block(['no_strategy_card_available']);
    }

    if (topCard.displayAction === 'ENTRAR') {
      return this.enter(dashboard, topCard);
    }

    if (topCard.displayAction === 'AGUARDAR') {
      return this.wait(dashboard, topCard);
    }

    return this.doNotUse(dashboard, topCard);
  }

  validateDashboard(dashboard, reasons) {
    if (dashboard.liveGate !== 'BLOCKED') {
      reasons.push('dashboard_live_gate_must_remain_blocked');
    }

    if (dashboard.productionMoneyAllowed !== false) {
      reasons.push('dashboard_production_money_must_remain_disabled');
    }

    if (dashboard.liveMoneyAuthorized !== false) {
      reasons.push('dashboard_live_money_must_remain_disabled');
    }

    if (!Array.isArray(dashboard.cards)) {
      reasons.push('dashboard_cards_not_array');
    }

    if (typeof dashboard.sessionStatus !== 'string' || dashboard.sessionStatus.length === 0) {
      reasons.push('missing_dashboard_session_status');
    }
  }

  resolveTopCard(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return null;
    }

    return cards[0];
  }

  enter(dashboard, card) {
    return Object.freeze({
      status: 'OPERATOR_ACTION_READY',
      operatorAction: 'ENTRAR',
      userAction: 'ENTRAR',
      actionPriority: 'HIGH',
      selectedStrategyId: card.strategyId,
      selectedStrategyTitle: card.title,
      scorePercent: this.clampPercent(card.scorePercent),
      message: 'Execução autorizada somente em PAPER.',
      reasons: Object.freeze(['strategy_execution_authorized_by_dashboard']),
      dashboardStatus: dashboard.sessionStatus,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  wait(dashboard, card) {
    return Object.freeze({
      status: 'OPERATOR_ACTION_WAIT',
      operatorAction: 'AGUARDAR',
      userAction: 'AGUARDAR',
      actionPriority: 'MEDIUM',
      selectedStrategyId: card.strategyId,
      selectedStrategyTitle: card.title,
      scorePercent: this.clampPercent(card.scorePercent),
      message: 'Aguardar nova confirmação contextual.',
      reasons: Object.freeze(['strategy_observation_mode']),
      dashboardStatus: dashboard.sessionStatus,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  doNotUse(dashboard, card) {
    return Object.freeze({
      status: 'OPERATOR_ACTION_BLOCKED',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      actionPriority: 'BLOCKING',
      selectedStrategyId: card.strategyId || 'UNKNOWN',
      selectedStrategyTitle: card.title || 'UNKNOWN',
      scorePercent: this.clampPercent(card.scorePercent),
      message: 'Nenhuma estratégia autorizada no contexto atual.',
      reasons: Object.freeze(['no_strategy_authorized']),
      dashboardStatus: dashboard.sessionStatus,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  block(reasons) {
    return Object.freeze({
      status: 'OPERATOR_ACTION_BLOCKED',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      actionPriority: 'BLOCKING',
      selectedStrategyId: 'UNKNOWN',
      selectedStrategyTitle: 'UNKNOWN',
      scorePercent: 0,
      message: 'Ação bloqueada por proteção institucional.',
      reasons: Object.freeze(reasons.slice()),
      dashboardStatus: 'SESSION_BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  clampPercent(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 100) {
      return 100;
    }

    return Math.round(value);
  }
}

module.exports = {
  OperatorActionCenter
};
