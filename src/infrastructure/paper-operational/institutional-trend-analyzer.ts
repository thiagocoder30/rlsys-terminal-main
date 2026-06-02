export type InstitutionalTrendDirection =
  | 'TREND_IMPROVING'
  | 'TREND_STABLE'
  | 'TREND_DEGRADING'
  | 'TREND_BLOCKING'
  | 'TREND_INSUFFICIENT';

export type InstitutionalTrendReason =
  | 'INSTITUTIONAL_TREND_ANALYZED'
  | 'INVALID_INSTITUTIONAL_TREND_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface InstitutionalTrendRecord {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly finalStatus: string;
  readonly finalConfidence: number;
  readonly favorableSuggestionCount: number;
  readonly suggestionCount: number;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
  readonly finishedAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalTrendPolicy {
  readonly minimumSessions: number;
  readonly maxSessions: number;
  readonly windowSize: number;
  readonly improvingDelta: number;
  readonly degradingDelta: number;
  readonly blockingNegativeRate: number;
}

export interface InstitutionalTrendInput {
  readonly records: readonly InstitutionalTrendRecord[];
  readonly policy: InstitutionalTrendPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalTrendEntityReport {
  readonly key: string;
  readonly sampleSize: number;
  readonly earlyScore: number;
  readonly recentScore: number;
  readonly delta: number;
  readonly negativeRate: number;
  readonly direction: InstitutionalTrendDirection;
  readonly suggestedAction: string;
}

export interface InstitutionalTrendReport {
  readonly usedSessions: number;
  readonly globalTrend: InstitutionalTrendEntityReport;
  readonly strategyTrends: readonly InstitutionalTrendEntityReport[];
  readonly tableTrends: readonly InstitutionalTrendEntityReport[];
  readonly operatorTrend: InstitutionalTrendEntityReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type InstitutionalTrendResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalTrendReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: InstitutionalTrendReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

interface MutableTrendSeries {
  readonly scores: number[];
  negativeCount: number;
}

const SCORE_PRECISION = 10_000;

/**
 * InstitutionalTrendAnalyzer
 *
 * Analisa tendência temporal entre sessões PAPER finalizadas:
 * estratégia melhorando/piorando, mesa fortalecendo/degradando e operador
 * estável ou em queda.
 *
 * Não executa aposta, não automatiza plataforma e não autoriza live money.
 * Complexidade O(n + e log e), memória limitada por maxSessions.
 */
export class InstitutionalTrendAnalyzer {
  public analyze(input: InstitutionalTrendInput): InstitutionalTrendResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Institutional trend analyzer cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.records)) {
      for (const record of input.records) {
        if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Institutional trend record cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_TREND_INPUT', invalidReason);
    }

    const ordered = [...input.records]
      .sort((left, right) => left.finishedAtEpochMs - right.finishedAtEpochMs)
      .slice(Math.max(0, input.records.length - input.policy.maxSessions));

    if (ordered.length < input.policy.minimumSessions) {
      const insufficient = this.emptyTrend('global');
      return {
        ok: true,
        value: {
          usedSessions: ordered.length,
          globalTrend: insufficient,
          strategyTrends: [],
          tableTrends: [],
          operatorTrend: this.emptyTrend('operator'),
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
        },
      };
    }

    const globalSeries: MutableTrendSeries = { scores: [], negativeCount: 0 };
    const operatorSeries: MutableTrendSeries = { scores: [], negativeCount: 0 };
    const strategyMap = new Map<string, MutableTrendSeries>();
    const tableMap = new Map<string, MutableTrendSeries>();

    for (const record of ordered) {
      const score = this.scoreRecord(record);
      const operatorScore = this.scoreOperator(record);
      const negative = this.isNegative(record);

      this.addScore(globalSeries, score, negative);
      this.addScore(operatorSeries, operatorScore, negative || operatorScore < 0.45);
      this.addToMap(strategyMap, record.strategyId, score, negative);
      this.addToMap(tableMap, record.tableId, score, negative);
    }

    const strategyTrends = this.toReports(strategyMap, input.policy);
    const tableTrends = this.toReports(tableMap, input.policy);

    return {
      ok: true,
      value: {
        usedSessions: ordered.length,
        globalTrend: this.toReport('global', globalSeries, input.policy),
        strategyTrends,
        tableTrends,
        operatorTrend: this.toReport('operator', operatorSeries, input.policy),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private addToMap(map: Map<string, MutableTrendSeries>, key: string, score: number, negative: boolean): void {
    const series = map.get(key) ?? { scores: [], negativeCount: 0 };
    this.addScore(series, score, negative);
    map.set(key, series);
  }

  private addScore(series: MutableTrendSeries, score: number, negative: boolean): void {
    series.scores.push(score);
    if (negative) {
      series.negativeCount += 1;
    }
  }

  private toReports(
    map: Map<string, MutableTrendSeries>,
    policy: InstitutionalTrendPolicy,
  ): readonly InstitutionalTrendEntityReport[] {
    const reports: InstitutionalTrendEntityReport[] = [];

    for (const [key, series] of map.entries()) {
      reports.push(this.toReport(key, series, policy));
    }

    reports.sort((left, right) => {
      if (right.recentScore !== left.recentScore) return right.recentScore - left.recentScore;
      return left.key.localeCompare(right.key);
    });

    return reports;
  }

  private toReport(
    key: string,
    series: MutableTrendSeries,
    policy: InstitutionalTrendPolicy,
  ): InstitutionalTrendEntityReport {
    if (series.scores.length < policy.minimumSessions) {
      return this.emptyTrend(key, series.scores.length);
    }

    const windowSize = Math.min(policy.windowSize, Math.floor(series.scores.length / 2));
    const early = series.scores.slice(0, windowSize);
    const recent = series.scores.slice(series.scores.length - windowSize);

    const earlyScore = this.average(early);
    const recentScore = this.average(recent);
    const delta = recentScore - earlyScore;
    const negativeRate = series.negativeCount / series.scores.length;
    const direction = this.classify(delta, negativeRate, policy);

    return {
      key,
      sampleSize: series.scores.length,
      earlyScore: this.roundScore(earlyScore),
      recentScore: this.roundScore(recentScore),
      delta: this.roundScore(delta),
      negativeRate: this.roundScore(negativeRate),
      direction,
      suggestedAction: this.actionFor(direction),
    };
  }

  private scoreRecord(record: InstitutionalTrendRecord): number {
    const favorableRate = record.suggestionCount > 0
      ? record.favorableSuggestionCount / record.suggestionCount
      : 0;

    const statusWeight = record.finalStatus.includes('STRONG')
      ? 1
      : record.finalStatus.includes('STABLE')
        ? 0.82
        : record.finalStatus.includes('NEUTRAL')
          ? 0.55
          : 0.25;

    const consensusWeight = record.consensusDecision.includes('CERTIFIED')
      ? 1
      : record.consensusDecision.includes('READY')
        ? 0.85
        : record.consensusDecision.includes('OBSERVE')
          ? 0.55
          : 0.25;

    return this.clamp(
      (record.finalConfidence / 100) * 0.35 +
      favorableRate * 0.25 +
      statusWeight * 0.25 +
      consensusWeight * 0.15,
      0,
      1,
    );
  }

  private scoreOperator(record: InstitutionalTrendRecord): number {
    if (record.operatorStatus.includes('STABLE') || record.operatorStatus.includes('APT')) {
      return 1;
    }

    if (record.operatorStatus.includes('COOLDOWN')) {
      return 0.45;
    }

    if (record.operatorStatus.includes('BLOCK')) {
      return 0.15;
    }

    return 0.65;
  }

  private isNegative(record: InstitutionalTrendRecord): boolean {
    return (
      record.finalStatus.includes('CAUTION') ||
      record.finalStatus.includes('BLOCK') ||
      record.consensusDecision.includes('BLOCK') ||
      record.finalConfidence < 55
    );
  }

  private classify(
    delta: number,
    negativeRate: number,
    policy: InstitutionalTrendPolicy,
  ): InstitutionalTrendDirection {
    if (negativeRate >= policy.blockingNegativeRate) return 'TREND_BLOCKING';
    if (delta >= policy.improvingDelta) return 'TREND_IMPROVING';
    if (delta <= -policy.degradingDelta) return 'TREND_DEGRADING';
    return 'TREND_STABLE';
  }

  private actionFor(direction: InstitutionalTrendDirection): string {
    if (direction === 'TREND_IMPROVING') return 'Aumentar peso gradualmente apenas se governança continuar aprovada.';
    if (direction === 'TREND_STABLE') return 'Manter peso institucional atual.';
    if (direction === 'TREND_DEGRADING') return 'Reduzir peso e exigir confirmação adicional.';
    if (direction === 'TREND_BLOCKING') return 'Bloquear ou enviar para revisão institucional.';
    return 'Aguardar mais sessões antes de calibrar.';
  }

  private emptyTrend(key: string, sampleSize = 0): InstitutionalTrendEntityReport {
    return {
      key,
      sampleSize,
      earlyScore: 0,
      recentScore: 0,
      delta: 0,
      negativeRate: 0,
      direction: 'TREND_INSUFFICIENT',
      suggestedAction: 'Aguardar mais sessões antes de calibrar.',
    };
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) return 0;

    let sum = 0;
    for (const value of values) {
      sum += value;
    }

    return sum / values.length;
  }

  private validateInput(input: InstitutionalTrendInput): string | null {
    if (typeof input !== 'object' || input === null) return 'input must be an object.';
    if (!Array.isArray(input.records) || input.records.length > 10000) return 'records must contain at most 10000 items.';

    for (const record of input.records) {
      const validation = this.validateRecord(record);
      if (validation !== null) return validation;
    }

    if (typeof input.policy !== 'object' || input.policy === null) return 'policy must be provided.';
    if (!Number.isInteger(input.policy.minimumSessions) || input.policy.minimumSessions < 2) return 'minimumSessions must be integer >= 2.';
    if (!Number.isInteger(input.policy.maxSessions) || input.policy.maxSessions < input.policy.minimumSessions || input.policy.maxSessions > 10000) return 'maxSessions must be valid.';
    if (!Number.isInteger(input.policy.windowSize) || input.policy.windowSize < 1 || input.policy.windowSize > input.policy.maxSessions) return 'windowSize must be valid.';
    if (!this.isScore(input.policy.improvingDelta)) return 'improvingDelta must be between 0 and 1.';
    if (!this.isScore(input.policy.degradingDelta)) return 'degradingDelta must be between 0 and 1.';
    if (!this.isScore(input.policy.blockingNegativeRate)) return 'blockingNegativeRate must be between 0 and 1.';

    return null;
  }

  private validateRecord(record: InstitutionalTrendRecord): string | null {
    if (typeof record !== 'object' || record === null) return 'each record must be an object.';
    if (!this.isSafeToken(record.sessionId, 3, 96)) return 'record.sessionId must be safe token.';
    if (!this.isSafeToken(record.tableId, 3, 96)) return 'record.tableId must be safe token.';
    if (!this.isSafeToken(record.strategyId, 3, 96)) return 'record.strategyId must be safe token.';
    if (!this.isMeaningful(record.finalStatus)) return 'record.finalStatus must be meaningful.';
    if (!Number.isFinite(record.finalConfidence) || record.finalConfidence < 0 || record.finalConfidence > 100) return 'record.finalConfidence must be between 0 and 100.';
    if (!Number.isInteger(record.suggestionCount) || record.suggestionCount < 0) return 'record.suggestionCount must be non-negative.';
    if (!Number.isInteger(record.favorableSuggestionCount) || record.favorableSuggestionCount < 0 || record.favorableSuggestionCount > record.suggestionCount) return 'record.favorableSuggestionCount must be valid.';
    if (!this.isMeaningful(record.operatorStatus)) return 'record.operatorStatus must be meaningful.';
    if (!this.isMeaningful(record.consensusDecision)) return 'record.consensusDecision must be meaningful.';
    if (!Number.isInteger(record.finishedAtEpochMs) || record.finishedAtEpochMs <= 0) return 'record.finishedAtEpochMs must be positive integer.';
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private fail(reason: InstitutionalTrendReason, message: string): InstitutionalTrendResult {
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
