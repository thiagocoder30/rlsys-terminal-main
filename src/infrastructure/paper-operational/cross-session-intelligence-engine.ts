export type CrossSessionDecision =
  | 'CROSS_SESSION_STRONG'
  | 'CROSS_SESSION_STABLE'
  | 'CROSS_SESSION_NEUTRAL'
  | 'CROSS_SESSION_CAUTION'
  | 'CROSS_SESSION_BLOCKING';

export type CrossSessionReason =
  | 'CROSS_SESSION_INTELLIGENCE_ANALYZED'
  | 'INVALID_CROSS_SESSION_INTELLIGENCE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface CrossSessionRecord {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly finalStatus: string;
  readonly finalConfidence: number;
  readonly suggestionCount: number;
  readonly favorableSuggestionCount: number;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
  readonly strategyReputation: string;
  readonly tableReputation: string;
  readonly finishedAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface CrossSessionPolicy {
  readonly minimumSessions: number;
  readonly maxSessions: number;
  readonly recentWindowMs: number;
  readonly minimumStrongScore: number;
  readonly minimumStableScore: number;
  readonly blockingNegativeRate: number;
}

export interface CrossSessionInput {
  readonly nowEpochMs: number;
  readonly records: readonly CrossSessionRecord[];
  readonly policy: CrossSessionPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface CrossSessionEntityIntelligence {
  readonly key: string;
  readonly sampleSize: number;
  readonly favorableRate: number;
  readonly averageConfidence: number;
  readonly operatorStableRate: number;
  readonly consensusSupportRate: number;
  readonly recentCoverage: number;
  readonly intelligenceScore: number;
  readonly suggestedWeight: number;
  readonly decision: CrossSessionDecision;
}

export interface CrossSessionIntelligenceReport {
  readonly totalSessions: number;
  readonly usedSessions: number;
  readonly globalFavorableRate: number;
  readonly globalAverageConfidence: number;
  readonly globalIntelligenceScore: number;
  readonly globalDecision: CrossSessionDecision;
  readonly strongestStrategy?: CrossSessionEntityIntelligence;
  readonly strongestTable?: CrossSessionEntityIntelligence;
  readonly weakestStrategy?: CrossSessionEntityIntelligence;
  readonly weakestTable?: CrossSessionEntityIntelligence;
  readonly strategyIntelligence: readonly CrossSessionEntityIntelligence[];
  readonly tableIntelligence: readonly CrossSessionEntityIntelligence[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type CrossSessionIntelligenceResult =
  | {
      readonly ok: true;
      readonly value: CrossSessionIntelligenceReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: CrossSessionReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

interface MutableAggregate {
  sampleSize: number;
  confidenceSum: number;
  favorableCount: number;
  operatorStableCount: number;
  consensusSupportCount: number;
  recentCount: number;
}

const SCORE_PRECISION = 10_000;

/**
 * CrossSessionIntelligenceEngine
 *
 * Consolida várias sessões PAPER finalizadas em inteligência institucional
 * acumulada por estratégia e mesa.
 *
 * Não executa aposta, não opera plataforma, não autoriza live money e não
 * substitui decisão humana. Serve para calibrar sessões futuras.
 *
 * Complexidade O(n + e log e), onde e é o número de entidades únicas.
 */
export class CrossSessionIntelligenceEngine {
  public analyze(input: CrossSessionInput): CrossSessionIntelligenceResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Cross session intelligence cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.records)) {
      for (const record of input.records) {
        if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Cross session record cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_CROSS_SESSION_INTELLIGENCE_INPUT', invalidReason);
    }

    const strategyAggregates = new Map<string, MutableAggregate>();
    const tableAggregates = new Map<string, MutableAggregate>();

    let usedSessions = 0;
    let confidenceSum = 0;
    let favorableCount = 0;
    let stableOperatorCount = 0;
    let consensusSupportCount = 0;
    let recentCount = 0;

    const startIndex = Math.max(0, input.records.length - input.policy.maxSessions);

    for (let index = startIndex; index < input.records.length; index += 1) {
      const record = input.records[index];

      usedSessions += 1;
      confidenceSum += record.finalConfidence;

      const favorable = this.isFavorable(record);
      const stableOperator = this.isStableOperator(record.operatorStatus);
      const consensusSupport = this.isConsensusSupport(record.consensusDecision);
      const recent = input.nowEpochMs - record.finishedAtEpochMs <= input.policy.recentWindowMs;

      if (favorable) favorableCount += 1;
      if (stableOperator) stableOperatorCount += 1;
      if (consensusSupport) consensusSupportCount += 1;
      if (recent) recentCount += 1;

      this.addToAggregate(strategyAggregates, record.strategyId, record, favorable, stableOperator, consensusSupport, recent);
      this.addToAggregate(tableAggregates, record.tableId, record, favorable, stableOperator, consensusSupport, recent);
    }

    if (usedSessions < input.policy.minimumSessions) {
      return {
        ok: true,
        value: {
          totalSessions: input.records.length,
          usedSessions,
          globalFavorableRate: 0,
          globalAverageConfidence: 0,
          globalIntelligenceScore: 0.5,
          globalDecision: 'CROSS_SESSION_NEUTRAL',
          strategyIntelligence: [],
          tableIntelligence: [],
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
        },
      };
    }

    const globalFavorableRate = favorableCount / usedSessions;
    const globalAverageConfidence = confidenceSum / usedSessions;
    const globalOperatorStableRate = stableOperatorCount / usedSessions;
    const globalConsensusSupportRate = consensusSupportCount / usedSessions;
    const globalRecentCoverage = recentCount / usedSessions;

    const globalIntelligenceScore = this.computeScore({
      favorableRate: globalFavorableRate,
      averageConfidence: globalAverageConfidence,
      operatorStableRate: globalOperatorStableRate,
      consensusSupportRate: globalConsensusSupportRate,
      recentCoverage: globalRecentCoverage,
      sampleConfidence: this.clamp(usedSessions / Math.max(1, input.policy.maxSessions), 0, 1),
    });

    const strategyIntelligence = this.toEntityReports(strategyAggregates, input.policy);
    const tableIntelligence = this.toEntityReports(tableAggregates, input.policy);

    const globalDecision = this.classify(globalIntelligenceScore, 1 - globalFavorableRate, input.policy);

    return {
      ok: true,
      value: {
        totalSessions: input.records.length,
        usedSessions,
        globalFavorableRate: this.roundScore(globalFavorableRate),
        globalAverageConfidence: this.roundScore(globalAverageConfidence),
        globalIntelligenceScore: this.roundScore(globalIntelligenceScore),
        globalDecision,
        strongestStrategy: this.first(strategyIntelligence),
        strongestTable: this.first(tableIntelligence),
        weakestStrategy: this.last(strategyIntelligence),
        weakestTable: this.last(tableIntelligence),
        strategyIntelligence,
        tableIntelligence,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private addToAggregate(
    aggregates: Map<string, MutableAggregate>,
    key: string,
    record: CrossSessionRecord,
    favorable: boolean,
    stableOperator: boolean,
    consensusSupport: boolean,
    recent: boolean,
  ): void {
    const current = aggregates.get(key) ?? {
      sampleSize: 0,
      confidenceSum: 0,
      favorableCount: 0,
      operatorStableCount: 0,
      consensusSupportCount: 0,
      recentCount: 0,
    };

    current.sampleSize += 1;
    current.confidenceSum += record.finalConfidence;
    if (favorable) current.favorableCount += 1;
    if (stableOperator) current.operatorStableCount += 1;
    if (consensusSupport) current.consensusSupportCount += 1;
    if (recent) current.recentCount += 1;

    aggregates.set(key, current);
  }

  private toEntityReports(
    aggregates: Map<string, MutableAggregate>,
    policy: CrossSessionPolicy,
  ): readonly CrossSessionEntityIntelligence[] {
    const reports: CrossSessionEntityIntelligence[] = [];

    for (const [key, aggregate] of aggregates.entries()) {
      const favorableRate = aggregate.favorableCount / aggregate.sampleSize;
      const averageConfidence = aggregate.confidenceSum / aggregate.sampleSize;
      const operatorStableRate = aggregate.operatorStableCount / aggregate.sampleSize;
      const consensusSupportRate = aggregate.consensusSupportCount / aggregate.sampleSize;
      const recentCoverage = aggregate.recentCount / aggregate.sampleSize;
      const sampleConfidence = this.clamp(aggregate.sampleSize / Math.max(1, policy.maxSessions), 0, 1);

      const intelligenceScore = this.computeScore({
        favorableRate,
        averageConfidence,
        operatorStableRate,
        consensusSupportRate,
        recentCoverage,
        sampleConfidence,
      });

      const negativeRate = 1 - favorableRate;
      const decision = this.classify(intelligenceScore, negativeRate, policy);

      reports.push({
        key,
        sampleSize: aggregate.sampleSize,
        favorableRate: this.roundScore(favorableRate),
        averageConfidence: this.roundScore(averageConfidence),
        operatorStableRate: this.roundScore(operatorStableRate),
        consensusSupportRate: this.roundScore(consensusSupportRate),
        recentCoverage: this.roundScore(recentCoverage),
        intelligenceScore: this.roundScore(intelligenceScore),
        suggestedWeight: this.roundScore(this.weightFor(decision, intelligenceScore)),
        decision,
      });
    }

    reports.sort((left, right) => {
      if (right.intelligenceScore !== left.intelligenceScore) {
        return right.intelligenceScore - left.intelligenceScore;
      }

      return left.key.localeCompare(right.key);
    });

    return reports;
  }

  private computeScore(input: {
    readonly favorableRate: number;
    readonly averageConfidence: number;
    readonly operatorStableRate: number;
    readonly consensusSupportRate: number;
    readonly recentCoverage: number;
    readonly sampleConfidence: number;
  }): number {
    return this.clamp(
      input.favorableRate * 0.28 +
      (input.averageConfidence / 100) * 0.24 +
      input.operatorStableRate * 0.14 +
      input.consensusSupportRate * 0.18 +
      input.recentCoverage * 0.08 +
      input.sampleConfidence * 0.08,
      0,
      1,
    );
  }

  private classify(score: number, negativeRate: number, policy: CrossSessionPolicy): CrossSessionDecision {
    if (negativeRate >= policy.blockingNegativeRate) return 'CROSS_SESSION_BLOCKING';
    if (score >= policy.minimumStrongScore) return 'CROSS_SESSION_STRONG';
    if (score >= policy.minimumStableScore) return 'CROSS_SESSION_STABLE';
    if (score >= 0.45) return 'CROSS_SESSION_NEUTRAL';
    return 'CROSS_SESSION_CAUTION';
  }

  private weightFor(decision: CrossSessionDecision, score: number): number {
    if (decision === 'CROSS_SESSION_STRONG') return this.clamp(1.1 + score * 0.18, 1.1, 1.28);
    if (decision === 'CROSS_SESSION_STABLE') return this.clamp(1 + score * 0.10, 1, 1.12);
    if (decision === 'CROSS_SESSION_NEUTRAL') return 1;
    if (decision === 'CROSS_SESSION_CAUTION') return 0.8;
    return 0.5;
  }

  private isFavorable(record: CrossSessionRecord): boolean {
    return (
      record.finalStatus.includes('STRONG') ||
      record.finalStatus.includes('STABLE') ||
      record.favorableSuggestionCount > 0 ||
      record.finalConfidence >= 80
    );
  }

  private isStableOperator(status: string): boolean {
    return status.includes('STABLE') || status.includes('APT');
  }

  private isConsensusSupport(decision: string): boolean {
    return decision.includes('READY') || decision.includes('CERTIFIED');
  }

  private validateInput(input: CrossSessionInput): string | null {
    if (typeof input !== 'object' || input === null) return 'input must be an object.';
    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) return 'nowEpochMs must be positive integer.';
    if (!Array.isArray(input.records) || input.records.length > 10000) return 'records must contain at most 10000 items.';

    for (const record of input.records) {
      const validation = this.validateRecord(record);
      if (validation !== null) return validation;
    }

    if (typeof input.policy !== 'object' || input.policy === null) return 'policy must be provided.';
    if (!Number.isInteger(input.policy.minimumSessions) || input.policy.minimumSessions < 1) return 'policy.minimumSessions must be positive integer.';
    if (!Number.isInteger(input.policy.maxSessions) || input.policy.maxSessions < input.policy.minimumSessions || input.policy.maxSessions > 10000) return 'policy.maxSessions must be between minimumSessions and 10000.';
    if (!Number.isInteger(input.policy.recentWindowMs) || input.policy.recentWindowMs < 1) return 'policy.recentWindowMs must be positive.';
    if (!this.isScore(input.policy.minimumStrongScore)) return 'policy.minimumStrongScore must be between 0 and 1.';
    if (!this.isScore(input.policy.minimumStableScore)) return 'policy.minimumStableScore must be between 0 and 1.';
    if (input.policy.minimumStableScore > input.policy.minimumStrongScore) return 'minimumStableScore cannot exceed minimumStrongScore.';
    if (!this.isScore(input.policy.blockingNegativeRate)) return 'policy.blockingNegativeRate must be between 0 and 1.';

    return null;
  }

  private validateRecord(record: CrossSessionRecord): string | null {
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
    if (!this.isMeaningful(record.strategyReputation)) return 'record.strategyReputation must be meaningful.';
    if (!this.isMeaningful(record.tableReputation)) return 'record.tableReputation must be meaningful.';
    if (!Number.isInteger(record.finishedAtEpochMs) || record.finishedAtEpochMs <= 0) return 'record.finishedAtEpochMs must be positive integer.';
    return null;
  }

  private first(values: readonly CrossSessionEntityIntelligence[]): CrossSessionEntityIntelligence | undefined {
    return values.length > 0 ? values[0] : undefined;
  }

  private last(values: readonly CrossSessionEntityIntelligence[]): CrossSessionEntityIntelligence | undefined {
    return values.length > 0 ? values[values.length - 1] : undefined;
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

  private fail(reason: CrossSessionReason, message: string): CrossSessionIntelligenceResult {
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
