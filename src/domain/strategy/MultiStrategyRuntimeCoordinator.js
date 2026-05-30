'use strict';

const { StrategyRuntimeOrchestrator } = require('./StrategyRuntimeOrchestrator');

class MultiStrategyRuntimeCoordinator {
  constructor(dependencies) {
    const deps = dependencies || {};
    this.strategyRuntimeOrchestrator = deps.strategyRuntimeOrchestrator || new StrategyRuntimeOrchestrator();
    this.maxStrategies = Number.isInteger(deps.maxStrategies) ? deps.maxStrategies : 100;

    if (this.maxStrategies < 1) {
      throw new Error('maxStrategies must be greater than zero');
    }
  }

  evaluate(input) {
    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const strategies = Array.isArray(input.strategies) ? input.strategies : [];

    if (strategies.length === 0) {
      return this.block(['no_strategies_registered']);
    }

    if (strategies.length > this.maxStrategies) {
      return this.block(['max_strategies_exceeded']);
    }

    const results = [];
    const reasons = [];

    for (let index = 0; index < strategies.length; index += 1) {
      const strategy = strategies[index];

      if (!strategy || typeof strategy !== 'object') {
        const invalid = this.invalidStrategy(index, ['strategy_definition_invalid']);
        results.push(invalid);
        reasons.push('strategy_definition_invalid');
        continue;
      }

      const runtime = this.strategyRuntimeOrchestrator.evaluate({
        ledger: strategy.ledger,
        strategyId: strategy.strategyId,
        currentRoundIndex: input.currentRoundIndex,
        contextRecoveryScore: input.contextRecoveryScore,
        tableContextScore: input.tableContextScore,
        operatorReadinessScore: input.operatorReadinessScore,
        liveConsensusScore: input.liveConsensusScore,
        riskScore: input.riskScore,
        strategyDoctrineScore: strategy.strategyDoctrineScore,
        memoryTrustScore: strategy.memoryTrustScore,
        supervisorVetoActive: input.supervisorVetoActive === true,
        sessionInterrupted: input.sessionInterrupted === true
      });

      results.push(runtime);
      this.appendReasons(reasons, runtime.reasons);
    }

    const orderedResults = this.orderResults(results);
    const summary = this.summarize(orderedResults);
    const blockedBySession = input.sessionInterrupted === true || input.supervisorVetoActive === true;

    return Object.freeze({
      status: 'MULTI_STRATEGY_RUNTIME_READY',
      totalStrategies: orderedResults.length,
      executionAuthorizedCount: summary.executionAuthorizedCount,
      observeCount: summary.observeCount,
      blockedCount: summary.blockedCount,
      topAction: summary.topAction,
      topStrategyId: summary.topStrategyId,
      results: Object.freeze(orderedResults),
      reasons: Object.freeze(this.unique(reasons)),
      operationalGate: blockedBySession ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      paperGate: blockedBySession ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  invalidStrategy(index, reasons) {
    return Object.freeze({
      status: 'STRATEGY_RUNTIME_BLOCKED',
      strategyId: `INVALID_${index}`,
      displayStatus: 'BLOQUEADO',
      displayAction: 'NAO_UTILIZAR',
      actionPriority: 'BLOCKING',
      scorePercent: 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  orderResults(results) {
    const copy = results.slice();

    copy.sort((a, b) => {
      const priorityDiff = this.priorityRank(a.actionPriority) - this.priorityRank(b.actionPriority);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return this.readScorePercent(b) - this.readScorePercent(a);
    });

    return copy;
  }

  summarize(results) {
    let executionAuthorizedCount = 0;
    let observeCount = 0;
    let blockedCount = 0;

    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];

      if (item.displayAction === 'ENTRAR') {
        executionAuthorizedCount += 1;
      } else if (item.displayAction === 'AGUARDAR') {
        observeCount += 1;
      } else {
        blockedCount += 1;
      }
    }

    const top = results.length > 0 ? results[0] : null;

    return {
      executionAuthorizedCount,
      observeCount,
      blockedCount,
      topAction: top ? top.displayAction : 'NAO_UTILIZAR',
      topStrategyId: top ? top.strategyId : 'UNKNOWN'
    };
  }

  priorityRank(priority) {
    if (priority === 'HIGH') {
      return 0;
    }

    if (priority === 'MEDIUM') {
      return 1;
    }

    return 2;
  }

  readScorePercent(item) {
    if (!item || !Number.isFinite(item.scorePercent)) {
      return 0;
    }

    return item.scorePercent;
  }

  appendReasons(target, values) {
    if (!Array.isArray(values)) {
      return;
    }

    for (let index = 0; index < values.length; index += 1) {
      target.push(values[index]);
    }
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

  block(reasons) {
    return Object.freeze({
      status: 'MULTI_STRATEGY_RUNTIME_BLOCKED',
      totalStrategies: 0,
      executionAuthorizedCount: 0,
      observeCount: 0,
      blockedCount: 0,
      topAction: 'NAO_UTILIZAR',
      topStrategyId: 'UNKNOWN',
      results: Object.freeze([]),
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
  MultiStrategyRuntimeCoordinator
};
