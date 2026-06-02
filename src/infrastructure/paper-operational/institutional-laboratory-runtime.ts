import { AdaptiveConfidenceCalibrationEngine } from './adaptive-confidence-calibration-engine';
import { CrossSessionIntelligenceEngine } from './cross-session-intelligence-engine';
import { InstitutionalTrendAnalyzer } from './institutional-trend-analyzer';
import type { AdaptiveConfidenceCalibrationReport } from './adaptive-confidence-calibration-engine';
import type { CrossSessionRecord } from './cross-session-intelligence-engine';
import type { InstitutionalTrendRecord } from './institutional-trend-analyzer';

export type InstitutionalLaboratoryRuntimeReason =
  | 'INSTITUTIONAL_LABORATORY_RUNTIME_OK'
  | 'INVALID_INSTITUTIONAL_LABORATORY_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface InstitutionalLaboratoryPolicy {
  readonly minimumSessions: number;
  readonly maxSessions: number;
  readonly recentWindowMs: number;
  readonly trendWindowSize: number;
  readonly minimumStrongScore: number;
  readonly minimumStableScore: number;
  readonly blockingNegativeRate: number;
}

export interface InstitutionalLaboratoryCalibrationRequest {
  readonly strategyId: string;
  readonly tableId: string;
  readonly baseConfidence: number;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
}

export interface InstitutionalLaboratoryRuntimeInput {
  readonly nowEpochMs: number;
  readonly records: readonly CrossSessionRecord[];
  readonly policy: InstitutionalLaboratoryPolicy;
  readonly calibration?: InstitutionalLaboratoryCalibrationRequest;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalLaboratoryRuntimeReport {
  readonly usedSessions: number;
  readonly globalDecision: string;
  readonly globalTrend: string;
  readonly strongestStrategy?: string;
  readonly strongestTable?: string;
  readonly weakestStrategy?: string;
  readonly weakestTable?: string;
  readonly calibration?: AdaptiveConfidenceCalibrationReport;
  readonly recommendation: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type InstitutionalLaboratoryRuntimeResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalLaboratoryRuntimeReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: InstitutionalLaboratoryRuntimeReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * InstitutionalLaboratoryRuntime
 *
 * Runtime institucional do laboratório:
 * - consolida sessões passadas;
 * - detecta tendências;
 * - calibra confiança futura;
 * - emite recomendação operacional PAPER.
 *
 * Não lê/escreve arquivos diretamente. I/O permanece no Repository/Adapter.
 * Não executa aposta, não automatiza plataforma e mantém live money bloqueado.
 */
export class InstitutionalLaboratoryRuntime {
  private readonly crossSession: CrossSessionIntelligenceEngine;
  private readonly trendAnalyzer: InstitutionalTrendAnalyzer;
  private readonly calibration: AdaptiveConfidenceCalibrationEngine;

  public constructor(
    crossSession: CrossSessionIntelligenceEngine = new CrossSessionIntelligenceEngine(),
    trendAnalyzer: InstitutionalTrendAnalyzer = new InstitutionalTrendAnalyzer(),
    calibration: AdaptiveConfidenceCalibrationEngine = new AdaptiveConfidenceCalibrationEngine(),
  ) {
    this.crossSession = crossSession;
    this.trendAnalyzer = trendAnalyzer;
    this.calibration = calibration;
  }

  public run(input: InstitutionalLaboratoryRuntimeInput): InstitutionalLaboratoryRuntimeResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Institutional laboratory runtime cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_LABORATORY_INPUT', invalidReason);
    }

    const cross = this.crossSession.analyze({
      nowEpochMs: input.nowEpochMs,
      records: input.records,
      policy: {
        minimumSessions: input.policy.minimumSessions,
        maxSessions: input.policy.maxSessions,
        recentWindowMs: input.policy.recentWindowMs,
        minimumStrongScore: input.policy.minimumStrongScore,
        minimumStableScore: input.policy.minimumStableScore,
        blockingNegativeRate: input.policy.blockingNegativeRate,
      },
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!cross.ok) {
      return this.fail('INVALID_INSTITUTIONAL_LABORATORY_INPUT', cross.error.message);
    }

    const trend = this.trendAnalyzer.analyze({
      records: this.toTrendRecords(input.records),
      policy: {
        minimumSessions: Math.max(2, input.policy.minimumSessions),
        maxSessions: input.policy.maxSessions,
        windowSize: input.policy.trendWindowSize,
        improvingDelta: 0.08,
        degradingDelta: 0.08,
        blockingNegativeRate: input.policy.blockingNegativeRate,
      },
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!trend.ok) {
      return this.fail('INVALID_INSTITUTIONAL_LABORATORY_INPUT', trend.error.message);
    }

    const calibrationReport = input.calibration !== undefined
      ? this.calibrate(input, cross.value.globalDecision, trend.value.globalTrend.direction)
      : undefined;

    if (calibrationReport !== undefined && !calibrationReport.ok) {
      return this.fail('INVALID_INSTITUTIONAL_LABORATORY_INPUT', calibrationReport.error.message);
    }

    const report: InstitutionalLaboratoryRuntimeReport = {
      usedSessions: cross.value.usedSessions,
      globalDecision: cross.value.globalDecision,
      globalTrend: trend.value.globalTrend.direction,
      strongestStrategy: cross.value.strongestStrategy?.key,
      strongestTable: cross.value.strongestTable?.key,
      weakestStrategy: cross.value.weakestStrategy?.key,
      weakestTable: cross.value.weakestTable?.key,
      calibration: calibrationReport?.value,
      recommendation: this.recommend(cross.value.globalDecision, trend.value.globalTrend.direction, calibrationReport?.value?.decision),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return {
      ok: true,
      value: report,
    };
  }

  private calibrate(
    input: InstitutionalLaboratoryRuntimeInput,
    globalDecision: string,
    globalTrend: string,
  ): ReturnType<AdaptiveConfidenceCalibrationEngine['calibrate']> | undefined {
    if (input.calibration === undefined) {
      return undefined;
    }

    const strategy = this.findStrategy(input.records, input.calibration.strategyId);
    const table = this.findTable(input.records, input.calibration.tableId);

    return this.calibration.calibrate({
      strategyId: input.calibration.strategyId,
      tableId: input.calibration.tableId,
      baseConfidence: input.calibration.baseConfidence,
      strategyReputationDecision: strategy.reputation,
      strategySuggestedWeight: strategy.weight,
      tableReputationDecision: table.reputation,
      tableSuggestedWeight: table.weight,
      crossSessionDecision: globalDecision,
      crossSessionSuggestedWeight: this.weightFromDecision(globalDecision),
      trendDirection: globalTrend,
      operatorStatus: input.calibration.operatorStatus,
      consensusDecision: input.calibration.consensusDecision,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });
  }

  private findStrategy(
    records: readonly CrossSessionRecord[],
    strategyId: string,
  ): { readonly reputation: string; readonly weight: number } {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index].strategyId === strategyId) {
        return {
          reputation: records[index].strategyReputation,
          weight: this.weightFromDecision(records[index].strategyReputation),
        };
      }
    }

    return { reputation: 'REPUTATION_NEUTRAL', weight: 1 };
  }

  private findTable(
    records: readonly CrossSessionRecord[],
    tableId: string,
  ): { readonly reputation: string; readonly weight: number } {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index].tableId === tableId) {
        return {
          reputation: records[index].tableReputation,
          weight: this.weightFromDecision(records[index].tableReputation),
        };
      }
    }

    return { reputation: 'TABLE_REPUTATION_NEUTRAL', weight: 1 };
  }

  private weightFromDecision(decision: string): number {
    if (decision.includes('STRONG')) return 1.18;
    if (decision.includes('STABLE')) return 1.08;
    if (decision.includes('NEUTRAL')) return 1;
    if (decision.includes('CAUTION') || decision.includes('VOLATILE') || decision.includes('DEGRADING')) return 0.82;
    if (decision.includes('BLOCK')) return 0;
    return 1;
  }

  private toTrendRecords(records: readonly CrossSessionRecord[]): readonly InstitutionalTrendRecord[] {
    return records.map((record) => ({
      sessionId: record.sessionId,
      tableId: record.tableId,
      strategyId: record.strategyId,
      finalStatus: record.finalStatus,
      finalConfidence: record.finalConfidence,
      favorableSuggestionCount: record.favorableSuggestionCount,
      suggestionCount: record.suggestionCount,
      operatorStatus: record.operatorStatus,
      consensusDecision: record.consensusDecision,
      finishedAtEpochMs: record.finishedAtEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    }));
  }

  private recommend(
    globalDecision: string,
    globalTrend: string,
    calibrationDecision?: string,
  ): string {
    if (
      globalDecision.includes('BLOCK') ||
      globalTrend.includes('BLOCK') ||
      calibrationDecision === 'CALIBRATION_BLOCKED'
    ) {
      return 'Bloquear operação PAPER e enviar laboratório para revisão institucional.';
    }

    if (globalTrend === 'TREND_DEGRADING' || calibrationDecision === 'CALIBRATION_REDUCED') {
      return 'Operar apenas em observação; exigir confirmação adicional antes de PAPER_FAVORAVEL.';
    }

    if (globalDecision.includes('STRONG') && globalTrend === 'TREND_IMPROVING') {
      return 'Laboratório favorável; permitir sugestão manual PAPER com governança ativa.';
    }

    return 'Manter operação PAPER supervisionada com peso institucional conservador.';
  }

  private validateInput(input: InstitutionalLaboratoryRuntimeInput): string | null {
    if (typeof input !== 'object' || input === null) return 'input must be an object.';
    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) return 'nowEpochMs must be positive integer.';
    if (!Array.isArray(input.records) || input.records.length > 10000) return 'records must contain at most 10000 items.';

    if (typeof input.policy !== 'object' || input.policy === null) return 'policy must be provided.';
    if (!Number.isInteger(input.policy.minimumSessions) || input.policy.minimumSessions < 1) return 'minimumSessions must be positive integer.';
    if (!Number.isInteger(input.policy.maxSessions) || input.policy.maxSessions < input.policy.minimumSessions || input.policy.maxSessions > 10000) return 'maxSessions must be valid.';
    if (!Number.isInteger(input.policy.recentWindowMs) || input.policy.recentWindowMs < 1) return 'recentWindowMs must be positive.';
    if (!Number.isInteger(input.policy.trendWindowSize) || input.policy.trendWindowSize < 1 || input.policy.trendWindowSize > input.policy.maxSessions) return 'trendWindowSize must be valid.';
    if (!this.isScore(input.policy.minimumStrongScore)) return 'minimumStrongScore must be score.';
    if (!this.isScore(input.policy.minimumStableScore)) return 'minimumStableScore must be score.';
    if (input.policy.minimumStableScore > input.policy.minimumStrongScore) return 'minimumStableScore cannot exceed minimumStrongScore.';
    if (!this.isScore(input.policy.blockingNegativeRate)) return 'blockingNegativeRate must be score.';

    if (input.calibration !== undefined) {
      if (!this.isSafeToken(input.calibration.strategyId, 3, 96)) return 'calibration.strategyId must be safe token.';
      if (!this.isSafeToken(input.calibration.tableId, 3, 96)) return 'calibration.tableId must be safe token.';
      if (!Number.isFinite(input.calibration.baseConfidence) || input.calibration.baseConfidence < 0 || input.calibration.baseConfidence > 100) return 'calibration.baseConfidence must be between 0 and 100.';
      if (!this.isMeaningful(input.calibration.operatorStatus)) return 'calibration.operatorStatus must be meaningful.';
      if (!this.isMeaningful(input.calibration.consensusDecision)) return 'calibration.consensusDecision must be meaningful.';
    }

    return null;
  }

  private isScore(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  private isMeaningful(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 3 && value.length <= 240;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private fail(
    reason: InstitutionalLaboratoryRuntimeReason,
    message: string,
  ): InstitutionalLaboratoryRuntimeResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
