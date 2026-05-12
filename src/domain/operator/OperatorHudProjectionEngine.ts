import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';
import type { ExplainabilityReport, ExplanationSeverity } from '../explainability/ExplainabilityEngine';
import type { IncrementalStatisticsSnapshot } from '../statistics/IncrementalStatisticsEngine';
import type { DomainEventBusSnapshot } from '../events/InternalEventBus';
import type { SessionPersistenceRecord, SessionRecoveryReport } from '../session/SessionPersistenceEngine';

export type OperatorHudMode = 'BLOCKED' | 'OBSERVE' | 'READY_RESEARCH_ONLY';
export type OperatorHudSeverity = 'CALM' | 'ATTENTION' | 'DANGER';
export type OperatorHudCardKind = 'STATUS' | 'RISK' | 'STRATEGY' | 'STATISTICS' | 'EXPLAINABILITY' | 'SYSTEM';

export interface OperatorHudProjectionInput {
  readonly explanation: ExplainabilityReport;
  readonly statistics?: IncrementalStatisticsSnapshot;
  readonly eventBus?: DomainEventBusSnapshot;
  readonly persistenceRecord?: SessionPersistenceRecord;
  readonly recovery?: SessionRecoveryReport;
  readonly maxCards?: number;
}

export interface OperatorHudCard {
  readonly kind: OperatorHudCardKind;
  readonly title: string;
  readonly value: string;
  readonly severity: OperatorHudSeverity;
  readonly details: readonly string[];
}

export interface OperatorHudRiskBand {
  readonly label: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface OperatorHudProjection {
  readonly engineVersion: 'operator-hud-projection-v1';
  readonly projectionId: string;
  readonly sessionId: string;
  readonly mode: OperatorHudMode;
  readonly headline: string;
  readonly primaryAction: string;
  readonly riskBand: OperatorHudRiskBand;
  readonly cards: readonly OperatorHudCard[];
  readonly compactStatusLine: string;
  readonly auditChecksum: string;
}

/**
 * Builds a bounded, deterministic operator HUD projection from domain reports.
 *
 * The engine is intentionally a presentation contract, not a frontend adapter.
 * It lives in the domain because it defines what the operator is allowed to see,
 * but it has no dependency on React, HTTP, terminal rendering or storage.
 *
 * Complexity: O(e + c), where e is bounded explainability evidence and c is the
 * requested card limit. Space is O(c), making it safe for low-memory Android
 * devices such as Helio P22 / 2GB RAM.
 */
export class OperatorHudProjectionEngine {
  private static readonly DEFAULT_MAX_CARDS = 8;

  public project(input: OperatorHudProjectionInput): Result<OperatorHudProjection, DomainError> {
    try {
      this.validate(input);
      const maxCards = this.cardLimit(input.maxCards);
      const mode = this.mode(input.explanation);
      const riskBand = this.riskBand(input);
      const cards = this.cards(input, riskBand, maxCards);
      const headline = this.headline(input.explanation, mode);
      const primaryAction = this.primaryAction(input.explanation, mode, riskBand);
      const compactStatusLine = this.compactStatusLine(input.explanation, mode, riskBand);
      const auditChecksum = this.checksum(input, mode, riskBand, cards, compactStatusLine);

      return ok({
        engineVersion: 'operator-hud-projection-v1',
        projectionId: auditChecksum.slice(0, 24),
        sessionId: input.explanation.sessionId,
        mode,
        headline,
        primaryAction,
        riskBand,
        cards,
        compactStatusLine,
        auditChecksum
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_operator_hud_projection_error';
      return err(new DomainError(message, 'OPERATOR_HUD_PROJECTION_FAILED'));
    }
  }

  private validate(input: OperatorHudProjectionInput): void {
    if (!input || typeof input !== 'object') throw new Error('invalid_operator_hud_input');
    if (!input.explanation || typeof input.explanation !== 'object') throw new Error('missing_operator_hud_explanation');
    if (!input.explanation.sessionId || typeof input.explanation.sessionId !== 'string') throw new Error('invalid_operator_hud_session');
    if (!Array.isArray(input.explanation.evidence)) throw new Error('invalid_operator_hud_evidence');
    if (input.maxCards !== undefined && (!Number.isInteger(input.maxCards) || input.maxCards < 1 || input.maxCards > 20)) {
      throw new Error('invalid_operator_hud_card_limit');
    }
  }

  private cardLimit(maxCards?: number): number {
    return maxCards ?? OperatorHudProjectionEngine.DEFAULT_MAX_CARDS;
  }

  private mode(explanation: ExplainabilityReport): OperatorHudMode {
    if (explanation.blockers.length > 0 || explanation.decisionStatus === 'REJECTED') return 'BLOCKED';
    if (explanation.decisionStatus === 'READY_FOR_RESEARCH_SIGNAL' && explanation.operationalGate === 'SIGNAL') return 'READY_RESEARCH_ONLY';
    return 'OBSERVE';
  }

  private riskBand(input: OperatorHudProjectionInput): OperatorHudRiskBand {
    const reasons: string[] = [];
    let score = 0;

    const modePressure = this.mode(input.explanation) === 'BLOCKED' ? 0.35 : 0;
    const blockerPressure = Math.min(1, input.explanation.blockers.length / 4);
    const warningPressure = Math.min(1, input.explanation.warnings.length / 6);
    score += modePressure;
    score += blockerPressure * 0.45;
    score += warningPressure * 0.2;
    if (modePressure > 0) reasons.push('modo bloqueado');
    if (blockerPressure > 0) reasons.push('bloqueadores ativos');
    if (warningPressure > 0) reasons.push('alertas operacionais');

    if (input.statistics) {
      score += input.statistics.trend === 'CONCENTRATING' || input.statistics.trend === 'REPEATING' ? 0.2 : 0;
      score += input.statistics.normalizedEntropy < 0.65 ? 0.1 : 0;
      if (input.statistics.trend === 'CONCENTRATING' || input.statistics.trend === 'REPEATING') reasons.push(`janela ${input.statistics.trend.toLowerCase()}`);
      if (input.statistics.normalizedEntropy < 0.65) reasons.push('entropia baixa');
    }

    if (input.eventBus && input.eventBus.totalObserverFailures > 0) {
      score += 0.15;
      reasons.push('falha isolada em observers');
    }

    if (input.recovery && input.recovery.status === 'CORRUPTED') {
      score = 1;
      reasons.push('recuperação corrompida');
    }

    const boundedScore = this.round(Math.min(1, score));
    const label: OperatorHudRiskBand['label'] = boundedScore >= 0.66 ? 'HIGH' : boundedScore >= 0.33 ? 'MEDIUM' : 'LOW';
    return { label, score: boundedScore, reasons: reasons.length === 0 ? ['sem pressão crítica detectada'] : reasons.slice(0, 6) };
  }

  private cards(input: OperatorHudProjectionInput, riskBand: OperatorHudRiskBand, maxCards: number): readonly OperatorHudCard[] {
    const cards: OperatorHudCard[] = [];
    const push = (card: OperatorHudCard): void => {
      if (cards.length < maxCards) cards.push(card);
    };

    push({
      kind: 'STATUS',
      title: 'Estado Operacional',
      value: input.explanation.decisionStatus,
      severity: this.severityFromMode(this.mode(input.explanation)),
      details: [input.explanation.executiveSummary, `Gate: ${input.explanation.operationalGate}`, `Ação: ${input.explanation.action}`]
    });

    push({
      kind: 'RISK',
      title: 'Risco Agregado',
      value: riskBand.label,
      severity: riskBand.label === 'HIGH' ? 'DANGER' : riskBand.label === 'MEDIUM' ? 'ATTENTION' : 'CALM',
      details: [`Score: ${riskBand.score}`, ...riskBand.reasons]
    });

    if (input.explanation.recommendedStrategy) {
      push({
        kind: 'STRATEGY',
        title: 'Estratégia Recomendada',
        value: input.explanation.recommendedStrategy.label,
        severity: input.explanation.blockers.length > 0 ? 'ATTENTION' : 'CALM',
        details: [
          `ID: ${input.explanation.recommendedStrategy.strategyId}`,
          `Rank: ${input.explanation.recommendedStrategy.rank}`,
          `Composite: ${input.explanation.recommendedStrategy.compositeScore}`
        ]
      });
    }

    if (input.statistics) {
      push({
        kind: 'STATISTICS',
        title: 'Janela Estatística',
        value: input.statistics.trend,
        severity: input.statistics.trend === 'BALANCED' ? 'CALM' : input.statistics.trend === 'INSUFFICIENT_DATA' ? 'ATTENTION' : 'DANGER',
        details: [
          `Amostras: ${input.statistics.activeSize}/${input.statistics.windowSize}`,
          `Entropia: ${input.statistics.normalizedEntropy}`,
          `Repetição: ${input.statistics.repeatRate}`,
          `Hot: ${input.statistics.hotNumbers.join(',')}`
        ]
      });
    }

    for (const evidence of input.explanation.evidence) {
      push({
        kind: 'EXPLAINABILITY',
        title: evidence.title,
        value: evidence.module,
        severity: this.severityFromEvidence(evidence.severity),
        details: [evidence.detail, `Peso: ${evidence.weight}`]
      });
    }

    if (input.eventBus) {
      push({
        kind: 'SYSTEM',
        title: 'Event Bus',
        value: `${input.eventBus.registeredObservers} observers`,
        severity: input.eventBus.totalObserverFailures > 0 ? 'ATTENTION' : 'CALM',
        details: [
          `Publicados: ${input.eventBus.totalPublished}`,
          `Entregues: ${input.eventBus.totalDelivered}`,
          `Falhas: ${input.eventBus.totalObserverFailures}`
        ]
      });
    }

    if (input.persistenceRecord) {
      push({
        kind: 'SYSTEM',
        title: 'Persistência',
        value: input.persistenceRecord.schemaVersion,
        severity: 'CALM',
        details: [`Journal: ${input.persistenceRecord.journal.length}`, `Checksum: ${input.persistenceRecord.recordChecksum.slice(0, 12)}`]
      });
    }

    return cards;
  }

  private severityFromMode(mode: OperatorHudMode): OperatorHudSeverity {
    if (mode === 'BLOCKED') return 'DANGER';
    if (mode === 'OBSERVE') return 'ATTENTION';
    return 'CALM';
  }

  private severityFromEvidence(severity: ExplanationSeverity): OperatorHudSeverity {
    if (severity === 'BLOCKER') return 'DANGER';
    if (severity === 'WARNING') return 'ATTENTION';
    return 'CALM';
  }

  private headline(explanation: ExplainabilityReport, mode: OperatorHudMode): string {
    if (mode === 'READY_RESEARCH_ONLY') return 'Hipótese de pesquisa pronta; execução real permanece bloqueada.';
    if (mode === 'BLOCKED') return `Operação bloqueada: ${explanation.primaryReason}`;
    return `Observação ativa: ${explanation.primaryReason}`;
  }

  private primaryAction(explanation: ExplainabilityReport, mode: OperatorHudMode, riskBand: OperatorHudRiskBand): string {
    if (mode === 'BLOCKED') return 'NÃO OPERAR — revisar bloqueadores.';
    if (riskBand.label === 'HIGH') return 'OBSERVAR — risco agregado alto.';
    if (mode === 'READY_RESEARCH_ONLY') return 'REGISTRAR SINAL DE PESQUISA — sem stake real.';
    return 'AGUARDAR NOVAS RODADAS.';
  }

  private compactStatusLine(explanation: ExplainabilityReport, mode: OperatorHudMode, riskBand: OperatorHudRiskBand): string {
    const strategy = explanation.recommendedStrategy ? explanation.recommendedStrategy.strategyId : 'sem-estrategia';
    return `${explanation.sessionId} | ${mode} | gate=${explanation.operationalGate} | risk=${riskBand.label} | strategy=${strategy}`;
  }

  private checksum(
    input: OperatorHudProjectionInput,
    mode: OperatorHudMode,
    riskBand: OperatorHudRiskBand,
    cards: readonly OperatorHudCard[],
    compactStatusLine: string
  ): string {
    const payload = JSON.stringify({
      sessionId: input.explanation.sessionId,
      explanationChecksum: input.explanation.checksum,
      statisticsChecksum: input.statistics?.checksum ?? null,
      eventBusChecksum: input.eventBus?.checksum ?? null,
      persistenceChecksum: input.persistenceRecord?.recordChecksum ?? null,
      recoveryStatus: input.recovery?.status ?? null,
      mode,
      riskBand,
      cards,
      compactStatusLine
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
