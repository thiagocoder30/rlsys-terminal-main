'use strict';

const { StrategyCooldownEngine } = require('./StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('./StrategyRecoveryEngine');
const { StrategyCompatibilityEngine } = require('./StrategyCompatibilityEngine');
const { StrategyRecommendationEngine } = require('./StrategyRecommendationEngine');
const { StrategyExplainabilityEngine } = require('./StrategyExplainabilityEngine');
const { StrategyStatusPresenter } = require('./StrategyStatusPresenter');

/**
 * Strategy Runtime Orchestrator.
 *
 * Runs the complete institutional per-strategy pipeline:
 *
 * cooldown -> recovery -> compatibility -> recommendation -> explanation -> status presenter
 *
 * It does not record results. Result recording remains responsibility of
 * StrategyResultLedgerEngine. This orchestrator only evaluates whether a
 * strategy may be used now and which operator-facing action should be shown.
 */
class StrategyRuntimeOrchestrator {
  constructor(dependencies) {
    const deps = dependencies || {};

    this.cooldownEngine = deps.cooldownEngine || new StrategyCooldownEngine();
    this.recoveryEngine = deps.recoveryEngine || new StrategyRecoveryEngine();
    this.compatibilityEngine = deps.compatibilityEngine || new StrategyCompatibilityEngine();
    this.recommendationEngine = deps.recommendationEngine || new StrategyRecommendationEngine();
    this.explainabilityEngine = deps.explainabilityEngine || new StrategyExplainabilityEngine();
    this.presenter = deps.presenter || new StrategyStatusPresenter();
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    if (!input.ledger || typeof input.ledger !== 'object') {
      return this.block(['missing_strategy_ledger']);
    }

    const currentRoundIndex = Number.isInteger(input.currentRoundIndex)
      ? input.currentRoundIndex
      : input.ledger.lastRoundIndex;

    const cooldown = this.cooldownEngine.evaluate({
      ledger: input.ledger,
      currentRoundIndex
    });

    const recovery = this.recoveryEngine.evaluate({
      ledger: input.ledger,
      cooldownDecision: cooldown,
      contextRecoveryScore: input.contextRecoveryScore,
      riskScore: input.riskScore,
      supervisorVetoActive: input.supervisorVetoActive === true
    });

    const compatibility = this.compatibilityEngine.evaluate({
      strategyId: input.strategyId || input.ledger.strategyId,
      recoveryDecision: recovery,
      tableContextScore: input.tableContextScore,
      operatorReadinessScore: input.operatorReadinessScore,
      liveConsensusScore: input.liveConsensusScore,
      riskScore: input.riskScore,
      strategyDoctrineScore: input.strategyDoctrineScore,
      memoryTrustScore: input.memoryTrustScore,
      supervisorVetoActive: input.supervisorVetoActive === true
    });

    const recommendation = this.recommendationEngine.recommend({
      compatibilityDecision: compatibility,
      supervisorVetoActive: input.supervisorVetoActive === true,
      sessionInterrupted: input.sessionInterrupted === true
    });

    const explanation = this.explainabilityEngine.explain({
      recommendation,
      cooldownActive: cooldown.status === 'STRATEGY_COOLDOWN',
      sessionRiskElevated: Number.isFinite(input.riskScore) && input.riskScore > 0.34
    });

    const statusView = this.presenter.present({
      explanation
    });

    this.appendReasons(reasons, cooldown.reasons);
    this.appendReasons(reasons, recovery.reasons);
    this.appendReasons(reasons, compatibility.reasons);
    this.appendReasons(reasons, recommendation.reasons);
    this.appendReasons(reasons, explanation.reasons);
    this.appendReasons(reasons, statusView.reasons);

    const blocked = statusView.displayStatus === 'BLOQUEADO' || statusView.displayAction === 'NAO_UTILIZAR';

    return Object.freeze({
      status: blocked ? 'STRATEGY_RUNTIME_BLOCKED' : 'STRATEGY_RUNTIME_READY',
      strategyId: statusView.strategyId,
      displayStatus: statusView.displayStatus,
      displayAction: statusView.displayAction,
      actionPriority: statusView.actionPriority,
      scorePercent: statusView.scorePercent,
      cooldown,
      recovery,
      compatibility,
      recommendation,
      explanation,
      statusView,
      reasons: Object.freeze(this.unique(reasons)),
      strategyGate: statusView.strategyGate,
      operationalGate: statusView.operationalGate,
      paperGate: statusView.paperGate,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
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
      status: 'STRATEGY_RUNTIME_BLOCKED',
      strategyId: 'UNKNOWN',
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
}

module.exports = {
  StrategyRuntimeOrchestrator
};
