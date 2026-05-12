import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';
import {
  StrategyDecisionEngine,
  type OperationalDecisionAction,
  type OperationalGateState,
  type StrategyDecisionContext,
  type StrategyDecisionReport,
  type StrategySignalSnapshot
} from './StrategyDecisionEngine';
import {
  StrategyRankingEngine,
  type StrategyRankingCandidate,
  type StrategyRankingItem,
  type StrategyRankingReport
} from '../strategy/StrategyRankingEngine';
import type { LiveSessionControlFrame } from '../session/LiveSessionStateMachine';
import type { RegimeClassificationReport } from '../regime/RegimeClassificationEngine';
import type { StrategyEnsembleReport } from '../strategy/StrategyEnsembleEngine';
import type { TemporalDecayReport } from '../temporal/TemporalDecayEngine';
import type { AdaptiveConfidenceReport } from '../confidence/AdaptiveConfidenceEngine';
import type { RuntimePerformanceBudgetReport } from '../performance/RuntimePerformanceBudgetEngine';

export type DecisionOrchestratorStatus = 'REJECTED' | 'OBSERVE' | 'READY_FOR_RESEARCH_SIGNAL';

export interface DecisionOrchestratorInput {
  readonly decisionContext: StrategyDecisionContext;
  readonly strategyCandidates: readonly StrategyRankingCandidate[];
  readonly sessionControl?: LiveSessionControlFrame;
  readonly regimeClassification?: RegimeClassificationReport;
  readonly strategyEnsemble?: StrategyEnsembleReport;
  readonly temporalDecay?: TemporalDecayReport;
  readonly adaptiveConfidence?: AdaptiveConfidenceReport;
  readonly runtimePerformanceBudget?: RuntimePerformanceBudgetReport;
}

export interface RecommendedStrategySnapshot {
  readonly strategyId: string;
  readonly label: string;
  readonly rank: number;
  readonly compositeScore: number;
  readonly bayesianHitRate: number;
  readonly evidenceScore: number;
  readonly riskPenalty: number;
  readonly confidenceDecay: number;
  readonly reasons: readonly string[];
}

export interface DecisionOrchestratorGovernance {
  readonly liveStakeAllowed: false;
  readonly executionMode: 'RESEARCH_ONLY';
  readonly reason: string;
}

export interface DecisionOrchestratorReport {
  readonly engineVersion: 'decision-orchestrator-v1';
  readonly orchestratorId: string;
  readonly sessionId: string;
  readonly status: DecisionOrchestratorStatus;
  readonly action: OperationalDecisionAction;
  readonly operationalGate: OperationalGateState;
  readonly recommendedStrategy: RecommendedStrategySnapshot | null;
  readonly ranking: StrategyRankingReport;
  readonly decision: StrategyDecisionReport;
  readonly regimeClassification: RegimeClassificationReport | null;
  readonly strategyEnsemble: StrategyEnsembleReport | null;
  readonly temporalDecay: TemporalDecayReport | null;
  readonly adaptiveConfidence: AdaptiveConfidenceReport | null;
  readonly runtimePerformanceBudget: RuntimePerformanceBudgetReport | null;
  readonly governance: DecisionOrchestratorGovernance;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly rationale: string;
}

/**
 * Coordinates strategy ranking and institutional decision governance.
 *
 * The orchestrator is an application-domain boundary: it composes pure domain
 * engines without depending on HTTP, UI, storage or vendor SDKs. Ranking remains
 * independent from decision rules, and the decision engine remains the single
 * source of truth for stake governance. Complexity is O(n log n + r), where n is
 * the number of strategy candidates and r is the number of decision rules.
 */
export class DecisionOrchestrator {
  private readonly rankingEngine: StrategyRankingEngine;
  private readonly decisionEngine: StrategyDecisionEngine;

  public constructor(rankingEngine = new StrategyRankingEngine(), decisionEngine = new StrategyDecisionEngine()) {
    this.rankingEngine = rankingEngine;
    this.decisionEngine = decisionEngine;
  }

  public orchestrate(input: DecisionOrchestratorInput): Result<DecisionOrchestratorReport, DomainError> {
    try {
      this.validateInput(input);
      const ranking = this.rankingEngine.rank(input.strategyCandidates);
      const enrichedContext = this.withRankedStrategy(input.decisionContext, ranking.topCandidate);
      const decision = this.decisionEngine.decide(enrichedContext);
      const sessionBlockers = this.sessionBlockers(input.sessionControl);
      const regimeBlockers = this.regimeBlockers(input.regimeClassification);
      const ensembleBlockers = this.ensembleBlockers(input.strategyEnsemble);
      const temporalBlockers = this.temporalBlockers(input.temporalDecay);
      const adaptiveConfidenceBlockers = this.adaptiveConfidenceBlockers(input.adaptiveConfidence);
      const runtimeBudgetBlockers = this.runtimeBudgetBlockers(input.runtimePerformanceBudget);
      const externalBlockers = [...sessionBlockers, ...regimeBlockers, ...ensembleBlockers, ...temporalBlockers, ...adaptiveConfidenceBlockers, ...runtimeBudgetBlockers];
      const operationalGate = this.resolveGate(decision.operationalGate, externalBlockers);
      const action = this.resolveAction(decision.action, externalBlockers);
      const blockers = [...decision.blockers, ...externalBlockers];
      const warnings = this.warnings(decision, ranking, input.sessionControl, input.regimeClassification, input.strategyEnsemble, input.temporalDecay, input.adaptiveConfidence, input.runtimePerformanceBudget);
      const recommendedStrategy = ranking.topCandidate ? this.recommendedStrategy(ranking.topCandidate) : null;
      const status = this.status(operationalGate, blockers.length, recommendedStrategy);
      const governance = this.governance(decision, sessionBlockers);
      const rationale = this.rationale(status, blockers, warnings, recommendedStrategy);

      return ok({
        engineVersion: 'decision-orchestrator-v1',
        orchestratorId: this.orchestratorId(enrichedContext.sessionId, ranking, decision, externalBlockers),
        sessionId: enrichedContext.sessionId,
        status,
        action,
        operationalGate,
        recommendedStrategy,
        ranking,
        decision,
        regimeClassification: input.regimeClassification ?? null,
        strategyEnsemble: input.strategyEnsemble ?? null,
        temporalDecay: input.temporalDecay ?? null,
        adaptiveConfidence: input.adaptiveConfidence ?? null,
        runtimePerformanceBudget: input.runtimePerformanceBudget ?? null,
        governance,
        blockers,
        warnings,
        rationale
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_decision_orchestrator_error';
      return err(new DomainError(message, 'DECISION_ORCHESTRATOR_FAILED'));
    }
  }

  private validateInput(input: DecisionOrchestratorInput): void {
    if (!input || typeof input !== 'object') throw new Error('invalid_decision_orchestrator_input');
    if (!input.decisionContext) throw new Error('missing_decision_context');
    if (!Array.isArray(input.strategyCandidates)) throw new Error('invalid_decision_orchestrator_candidates');
  }

  private withRankedStrategy(context: StrategyDecisionContext, topCandidate: StrategyRankingItem | null): StrategyDecisionContext {
    if (!topCandidate || topCandidate.decision !== 'ELIGIBLE') {
      return {
        ...context,
        strategy: {
          ...context.strategy,
          status: context.strategy.status === 'DENIED' ? 'DENIED' : 'LOCKED',
          signalCount: 0,
          maxSignalConfidence: 0,
          suggestedFraction: 0
        }
      };
    }

    const rankedStrategy: StrategySignalSnapshot = {
      ...context.strategy,
      status: 'ALLOWED',
      signalCount: Math.max(1, context.strategy.signalCount),
      maxSignalConfidence: round(Math.max(context.strategy.maxSignalConfidence, topCandidate.confidenceDecay)),
      suggestedFraction: round(Math.min(0.005, Math.max(context.strategy.suggestedFraction, topCandidate.compositeScore * 0.004))),
      riskLevel: topCandidate.riskPenalty >= 0.62 ? 'CRITICAL' : topCandidate.riskPenalty >= 0.46 ? 'HIGH' : topCandidate.riskPenalty >= 0.28 ? 'MEDIUM' : 'LOW'
    };

    return { ...context, strategy: rankedStrategy };
  }

  private sessionBlockers(control?: LiveSessionControlFrame): readonly string[] {
    if (!control) return [];
    if (control.nextAction === 'EVALUATE_DECISION') return [];
    if (control.phase === 'COOLDOWN') return [`Sessão live em cooldown: ${control.reason}`];
    if (control.phase === 'BLOCKED') return [`Sessão live bloqueada: ${control.reason}`];
    return [`Sessão live ainda não está pronta para decisão: ${control.reason}`];
  }

  private regimeBlockers(regime?: RegimeClassificationReport): readonly string[] {
    if (!regime) return [];
    if (regime.signalPolicy === 'BLOCK_SIGNALS') {
      return [`Regime ${regime.regime} bloqueia sinais: ${regime.rationale}`];
    }
    return [];
  }

  private ensembleBlockers(ensemble?: StrategyEnsembleReport): readonly string[] {
    if (!ensemble) return [];
    if (ensemble.decision === 'CONSENSUS') return [];
    if (ensemble.decision === 'CONFLICT') return [`Ensemble bloqueia sinal por conflito estratégico: ${ensemble.blockers.slice(0, 2).join('; ')}`];
    if (ensemble.decision === 'BLOCKED') return [`Ensemble bloqueia sinal por veto estratégico: ${ensemble.blockers.slice(0, 2).join('; ')}`];
    return [`Ensemble sem suporte suficiente: ${ensemble.blockers.slice(0, 2).join('; ')}`];
  }

  private temporalBlockers(temporal?: TemporalDecayReport): readonly string[] {
    if (!temporal) return [];
    if (temporal.decision === 'ALLOW') return [];
    if (temporal.decision === 'BLOCK_EXPIRED') {
      return [`Decaimento temporal bloqueia sinal: ${temporal.blockers.slice(0, 2).join('; ')}`];
    }
    return [];
  }


  private adaptiveConfidenceBlockers(confidence?: AdaptiveConfidenceReport): readonly string[] {
    if (!confidence) return [];
    if (confidence.decision === 'ALLOW') return [];
    if (confidence.decision === 'BLOCK_LOW_CONFIDENCE') {
      return [`Confiança adaptativa bloqueia sinal: ${confidence.blockers.slice(0, 2).join('; ')}`];
    }
    return [];
  }


  private runtimeBudgetBlockers(budget?: RuntimePerformanceBudgetReport): readonly string[] {
    if (!budget) return [];
    if (budget.status === 'WITHIN_BUDGET' || budget.status === 'THROTTLE') return [];
    if (budget.status === 'BLOCKED') {
      return [`Orçamento de performance bloqueia avaliação live: ${budget.recommendations.slice(0, 2).join('; ')}`];
    }
    return [`Orçamento de performance degradado exige bloqueio preventivo: ${budget.violations.slice(0, 2).map(violation => violation.message).join('; ')}`];
  }

  private resolveGate(current: OperationalGateState, externalBlockers: readonly string[]): OperationalGateState {
    if (externalBlockers.length === 0) return current;
    if (externalBlockers.some(message => message.includes('cooldown'))) return 'COOLDOWN';
    if (externalBlockers.some(message => message.includes('bloqueia sinais') || message.includes('Ensemble bloqueia') || message.includes('Decaimento temporal bloqueia') || message.includes('Confiança adaptativa bloqueia') || message.includes('Confiança adaptativa bloqueia'))) return 'NO_GO';
    return 'OBSERVE';
  }

  private resolveAction(current: OperationalDecisionAction, externalBlockers: readonly string[]): OperationalDecisionAction {
    if (externalBlockers.length === 0) return current;
    if (externalBlockers.some(message => message.includes('bloqueia sinais') || message.includes('Ensemble bloqueia') || message.includes('Decaimento temporal bloqueia') || message.includes('Confiança adaptativa bloqueia') || message.includes('Orçamento de performance'))) return 'BLOCKED';
    return current === 'BLOCKED' ? 'BLOCKED' : 'OBSERVE';
  }

  private warnings(
    decision: StrategyDecisionReport,
    ranking: StrategyRankingReport,
    control?: LiveSessionControlFrame,
    regime?: RegimeClassificationReport,
    ensemble?: StrategyEnsembleReport,
    temporal?: TemporalDecayReport,
    adaptiveConfidence?: AdaptiveConfidenceReport,
    runtimeBudget?: RuntimePerformanceBudgetReport
  ): readonly string[] {
    const warnings: string[] = [...decision.warnings];
    if (ranking.eligibleCount === 0) warnings.push('Nenhuma estratégia elegível no ranking bayesiano.');
    if (control && control.nextAction !== 'EVALUATE_DECISION') warnings.push('Snapshot live usado apenas para observação; janela ainda não pronta para sinal.');
    if (regime?.signalPolicy === 'OBSERVE_ONLY') warnings.push(`Regime ${regime.regime} limita decisão para observação: ${regime.rationale}`);
    if (ensemble?.decision === 'INSUFFICIENT_SUPPORT') warnings.push('Ensemble não alcançou suporte suficiente para consenso institucional.');
    if (ensemble?.warnings.length) warnings.push(...ensemble.warnings);
    if (temporal?.decision === 'OBSERVE') warnings.push('Decaimento temporal exige observação: sinal ainda ativo, mas com frescor reduzido.');
    if (temporal?.warnings.length) warnings.push(...temporal.warnings);
    if (adaptiveConfidence?.decision === 'OBSERVE') warnings.push('Confiança adaptativa exige observação: threshold dinâmico ainda não foi superado.');
    if (adaptiveConfidence?.warnings.length) warnings.push(...adaptiveConfidence.warnings);
    if (runtimeBudget?.status === 'THROTTLE') warnings.push(`Orçamento de performance solicita redução de carga: throttleFactor=${runtimeBudget.throttleFactor}.`);
    if (runtimeBudget?.recommendations.length && runtimeBudget.status !== 'WITHIN_BUDGET') warnings.push(...runtimeBudget.recommendations.slice(0, 2));
    return warnings;
  }

  private status(
    gate: OperationalGateState,
    blockerCount: number,
    recommendedStrategy: RecommendedStrategySnapshot | null
  ): DecisionOrchestratorStatus {
    if (blockerCount > 0 || gate === 'NO_GO') return 'REJECTED';
    if (gate === 'SIGNAL' && recommendedStrategy) return 'READY_FOR_RESEARCH_SIGNAL';
    return 'OBSERVE';
  }

  private recommendedStrategy(item: StrategyRankingItem): RecommendedStrategySnapshot {
    return {
      strategyId: item.strategyId,
      label: item.label,
      rank: item.rank,
      compositeScore: item.compositeScore,
      bayesianHitRate: item.bayesianHitRate,
      evidenceScore: item.evidenceScore,
      riskPenalty: item.riskPenalty,
      confidenceDecay: item.confidenceDecay,
      reasons: item.reasons
    };
  }

  private governance(decision: StrategyDecisionReport, sessionBlockers: readonly string[]): DecisionOrchestratorGovernance {
    const reason = sessionBlockers.length > 0
      ? 'Governança mantém execução real bloqueada porque sessão/regime ainda não autorizam avaliação.'
      : 'Governança mantém execução real bloqueada: etapa atual é exclusivamente RESEARCH_ONLY.';

    return {
      liveStakeAllowed: false,
      executionMode: decision.execution.mode,
      reason
    };
  }

  private rationale(
    status: DecisionOrchestratorStatus,
    blockers: readonly string[],
    warnings: readonly string[],
    recommendedStrategy: RecommendedStrategySnapshot | null
  ): string {
    if (blockers.length > 0) return `Orquestração ${status}: bloqueadores ativos (${blockers.slice(0, 3).join('; ')}).`;
    if (!recommendedStrategy) return `Orquestração ${status}: ranking não encontrou estratégia elegível para decisão.`;
    if (warnings.length > 0) return `Orquestração ${status}: ${recommendedStrategy.strategyId} lidera o ranking, com alertas (${warnings.slice(0, 3).join('; ')}).`;
    return `Orquestração ${status}: ${recommendedStrategy.strategyId} recomenda hipótese somente para pesquisa, sem stake real.`;
  }

  private orchestratorId(
    sessionId: string,
    ranking: StrategyRankingReport,
    decision: StrategyDecisionReport,
    externalBlockers: readonly string[]
  ): string {
    const payload = JSON.stringify({ sessionId, ranking, decisionId: decision.reportId, externalBlockers });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
  }
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
