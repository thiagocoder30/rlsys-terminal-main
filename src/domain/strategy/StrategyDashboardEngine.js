'use strict';

/**
 * Strategy Dashboard Engine.
 *
 * Builds a lightweight operator-facing dashboard from MultiStrategyRuntimeCoordinator.
 * It does not calculate strategy eligibility by itself. It only presents the
 * already-supervised runtime state in a compact, deterministic and auditable way.
 */
class StrategyDashboardEngine {
  constructor(config) {
    this.config = Object.freeze({
      maxVisibleStrategies: Number.isInteger(config && config.maxVisibleStrategies)
        ? Number(config.maxVisibleStrategies)
        : 10
    });

    if (this.config.maxVisibleStrategies < 1) {
      throw new Error('maxVisibleStrategies must be greater than zero');
    }
  }

  compose(input) {
    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const runtime = input.multiStrategyRuntime;

    if (!runtime || typeof runtime !== 'object') {
      return this.block(['missing_multi_strategy_runtime']);
    }

    const reasons = [];
    this.validateRuntime(runtime, reasons);

    if (reasons.length > 0) {
      return this.block(reasons);
    }

    const results = Array.isArray(runtime.results) ? runtime.results.slice(0, this.config.maxVisibleStrategies) : [];
    const cards = [];

    for (let index = 0; index < results.length; index += 1) {
      cards.push(this.toCard(results[index], index + 1));
    }

    const sessionStatus = this.resolveSessionStatus(runtime);
    const headline = this.resolveHeadline(runtime, sessionStatus);
    const rendered = this.renderDashboard(runtime, cards, headline, sessionStatus);

    return Object.freeze({
      status: 'STRATEGY_DASHBOARD_READY',
      sessionStatus,
      headline,
      totalStrategies: runtime.totalStrategies,
      visibleStrategies: cards.length,
      executionAuthorizedCount: runtime.executionAuthorizedCount,
      observeCount: runtime.observeCount,
      blockedCount: runtime.blockedCount,
      topAction: runtime.topAction,
      topStrategyId: runtime.topStrategyId,
      cards: Object.freeze(cards),
      rendered,
      reasons: Object.freeze(Array.isArray(runtime.reasons) ? runtime.reasons.slice() : []),
      operationalGate: runtime.operationalGate,
      paperGate: runtime.paperGate,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateRuntime(runtime, reasons) {
    if (runtime.liveGate !== 'BLOCKED') {
      reasons.push('runtime_live_gate_must_remain_blocked');
    }

    if (runtime.productionMoneyAllowed !== false) {
      reasons.push('runtime_production_money_must_remain_disabled');
    }

    if (runtime.liveMoneyAuthorized !== false) {
      reasons.push('runtime_live_money_must_remain_disabled');
    }

    if (!Array.isArray(runtime.results)) {
      reasons.push('runtime_results_not_array');
    }

    if (!Number.isInteger(runtime.totalStrategies) || runtime.totalStrategies < 0) {
      reasons.push('runtime_total_strategies_invalid');
    }

    if (!Number.isInteger(runtime.executionAuthorizedCount) || runtime.executionAuthorizedCount < 0) {
      reasons.push('runtime_execution_count_invalid');
    }

    if (!Number.isInteger(runtime.observeCount) || runtime.observeCount < 0) {
      reasons.push('runtime_observe_count_invalid');
    }

    if (!Number.isInteger(runtime.blockedCount) || runtime.blockedCount < 0) {
      reasons.push('runtime_blocked_count_invalid');
    }
  }

  toCard(result, rank) {
    const displayAction = typeof result.displayAction === 'string' ? result.displayAction : 'NAO_UTILIZAR';
    const displayStatus = typeof result.displayStatus === 'string' ? result.displayStatus : 'BLOQUEADO';
    const strategyId = typeof result.strategyId === 'string' ? result.strategyId : 'UNKNOWN';
    const scorePercent = Number.isFinite(result.scorePercent) ? this.clampPercent(result.scorePercent) : 0;

    return Object.freeze({
      rank,
      strategyId,
      title: this.resolveTitle(strategyId),
      displayStatus,
      displayAction,
      actionPriority: typeof result.actionPriority === 'string' ? result.actionPriority : 'BLOCKING',
      scorePercent,
      line: `${rank}. ${this.resolveTitle(strategyId)} | ${displayStatus} | ${displayAction} | ${scorePercent}%`
    });
  }

  resolveSessionStatus(runtime) {
    if (runtime.operationalGate === 'BLOCKED' || runtime.paperGate === 'BLOCKED') {
      return 'SESSION_BLOCKED';
    }

    if (runtime.executionAuthorizedCount > 0) {
      return 'ACTION_AVAILABLE';
    }

    if (runtime.observeCount > 0) {
      return 'OBSERVATION_MODE';
    }

    return 'NO_STRATEGY_AVAILABLE';
  }

  resolveHeadline(runtime, sessionStatus) {
    if (sessionStatus === 'SESSION_BLOCKED') {
      return 'Sessão bloqueada. Não utilizar estratégias.';
    }

    if (sessionStatus === 'ACTION_AVAILABLE') {
      return `Estratégia prioritária: ${this.resolveTitle(runtime.topStrategyId)} — ação ${runtime.topAction}.`;
    }

    if (sessionStatus === 'OBSERVATION_MODE') {
      return 'Nenhuma execução autorizada. Manter observação.';
    }

    return 'Nenhuma estratégia disponível no contexto atual.';
  }

  renderDashboard(runtime, cards, headline, sessionStatus) {
    const lines = [
      '================================',
      'RL.SYS CORE — Strategy Dashboard',
      `Status da sessão: ${sessionStatus}`,
      `Resumo: ${headline}`,
      `Execução autorizada: ${runtime.executionAuthorizedCount}`,
      `Observar: ${runtime.observeCount}`,
      `Bloqueadas: ${runtime.blockedCount}`,
      '--------------------------------'
    ];

    for (let index = 0; index < cards.length; index += 1) {
      lines.push(cards[index].line);
    }

    lines.push('--------------------------------');
    lines.push('Live Money: BLOQUEADO');
    lines.push('================================');

    return lines.join('\n');
  }

  resolveTitle(strategyId) {
    if (strategyId === 'UNKNOWN') {
      return 'UNKNOWN';
    }

    return strategyId
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  clampPercent(value) {
    if (value < 0) {
      return 0;
    }

    if (value > 100) {
      return 100;
    }

    return Math.round(value);
  }

  block(reasons) {
    return Object.freeze({
      status: 'STRATEGY_DASHBOARD_BLOCKED',
      sessionStatus: 'SESSION_BLOCKED',
      headline: 'Dashboard bloqueado por proteção institucional.',
      totalStrategies: 0,
      visibleStrategies: 0,
      executionAuthorizedCount: 0,
      observeCount: 0,
      blockedCount: 0,
      topAction: 'NAO_UTILIZAR',
      topStrategyId: 'UNKNOWN',
      cards: Object.freeze([]),
      rendered: [
        '================================',
        'RL.SYS CORE — Strategy Dashboard',
        'Status da sessão: SESSION_BLOCKED',
        'Resumo: Dashboard bloqueado por proteção institucional.',
        'Live Money: BLOQUEADO',
        '================================'
      ].join('\n'),
      reasons: Object.freeze(reasons.slice()),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }
}

module.exports = {
  StrategyDashboardEngine
};
