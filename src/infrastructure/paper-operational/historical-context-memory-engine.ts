export type HistoricalContextOutcome = 'FAVORAVEL' | 'OBSERVAR' | 'NAO_UTILIZAR';

export type HistoricalContextMemoryDecision =
  | 'MEMORY_SUPPORTIVE'
  | 'MEMORY_NEUTRAL'
  | 'MEMORY_CAUTION'
  | 'MEMORY_BLOCKING';

export type HistoricalContextMemoryReason =
  | 'HISTORICAL_CONTEXT_MEMORY_ANALYZED'
  | 'INVALID_HISTORICAL_CONTEXT_MEMORY_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface HistoricalContextRecord {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly outcome: HistoricalContextOutcome;
  readonly confidence: number;
  readonly netPnL: number;
  readonly maxDrawdownPercent: number;
  readonly consistencyScore: number;
  readonly occurredAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface HistoricalContextMemoryPolicy {
  readonly minimumRecords: number;
  readonly maxRecords: number;
  readonly recentWindowMs: number;
  readonly maxDrawdownPercentForSupport: number;
  readonly minimumConsistencyForSupport: number;
  readonly minimumMemoryConfidenceForSupport: number;
}

export interface HistoricalContextMemoryInput {
  readonly tableId: string;
  readonly strategyId: string;
  readonly nowEpochMs: number;
  readonly records: readonly HistoricalContextRecord[];
  readonly policy: HistoricalContextMemoryPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface HistoricalContextMemoryReport {
  readonly tableId: string;
  readonly strategyId: string;
  readonly totalRecords: number;
  readonly usedRecords: number;
  readonly favorableCount: number;
  readonly observeCount: number;
  readonly blockedCount: number;
  readonly favorableRate: number;
  readonly averageConfidence: number;
  readonly averageNetPnL: number;
  readonly averageDrawdownPercent: number;
  readonly averageConsistencyScore: number;
  readonly recencyCoverage: number;
  readonly memoryConfidence: number;
  readonly decision: HistoricalContextMemoryDecision;
  readonly suggestedWeight: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type HistoricalContextMemoryResult =
  | {
      readonly ok: true;
      readonly value: HistoricalContextMemoryReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: HistoricalContextMemoryReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * HistoricalContextMemoryEngine
 *
 * Memória institucional leve para mesa/estratégia. Agrega sessões finalizadas
 * e devolve peso contextual defensivo sem modificar sessão ativa.
 *
 * Não executa apostas, não opera live money, não faz overfitting e não usa
 * arrays auxiliares grandes. O processamento é O(n), memória O(1).
 */
export class HistoricalContextMemoryEngine {
  public evaluate(input: HistoricalContextMemoryInput): HistoricalContextMemoryResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Historical context memory cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.records)) {
      for (const record of input.records) {
        if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Historical context record cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_HISTORICAL_CONTEXT_MEMORY_INPUT', invalidReason);
    }

    let usedRecords = 0;
    let favorableCount = 0;
    let observeCount = 0;
    let blockedCount = 0;
    let confidenceSum = 0;
    let netPnLSum = 0;
    let drawdownSum = 0;
    let consistencySum = 0;
    let recentRecords = 0;

    const startIndex = Math.max(0, input.records.length - input.policy.maxRecords);

    for (let index = startIndex; index < input.records.length; index += 1) {
      const record = input.records[index];

      if (record.tableId !== input.tableId || record.strategyId !== input.strategyId) {
        continue;
      }

      usedRecords += 1;
      confidenceSum += record.confidence;
      netPnLSum += record.netPnL;
      drawdownSum += record.maxDrawdownPercent;
      consistencySum += record.consistencyScore;

      if (record.outcome === 'FAVORAVEL') {
        favorableCount += 1;
      } else if (record.outcome === 'OBSERVAR') {
        observeCount += 1;
      } else {
        blockedCount += 1;
      }

      if (input.nowEpochMs - record.occurredAtEpochMs <= input.policy.recentWindowMs) {
        recentRecords += 1;
      }
    }

    if (usedRecords < input.policy.minimumRecords) {
      return this.success(input, {
        usedRecords,
        favorableCount,
        observeCount,
        blockedCount,
        favorableRate: 0,
        averageConfidence: 0,
        averageNetPnL: 0,
        averageDrawdownPercent: 0,
        averageConsistencyScore: 0,
        recencyCoverage: 0,
        memoryConfidence: 0,
        decision: 'MEMORY_NEUTRAL',
        suggestedWeight: 1,
        explanation: 'Memória histórica insuficiente; manter peso neutro e evitar overfitting.',
      });
    }

    const favorableRate = favorableCount / usedRecords;
    const averageConfidence = confidenceSum / usedRecords;
    const averageNetPnL = netPnLSum / usedRecords;
    const averageDrawdownPercent = drawdownSum / usedRecords;
    const averageConsistencyScore = consistencySum / usedRecords;
    const recencyCoverage = recentRecords / usedRecords;
    const sampleConfidence = this.clamp(usedRecords / Math.max(1, input.policy.maxRecords), 0, 1);

    const memoryConfidence = this.clamp(
      (favorableRate * 0.30) +
      (averageConfidence / 100 * 0.25) +
      (averageConsistencyScore * 0.20) +
      (recencyCoverage * 0.15) +
      (sampleConfidence * 0.10),
      0,
      1,
    );

    const decision = this.classify(input.policy, {
      usedRecords,
      favorableRate,
      averageDrawdownPercent,
      averageConsistencyScore,
      memoryConfidence,
      blockedCount,
    });

    const suggestedWeight = this.computeSuggestedWeight(decision, memoryConfidence, averageDrawdownPercent);

    return this.success(input, {
      usedRecords,
      favorableCount,
      observeCount,
      blockedCount,
      favorableRate,
      averageConfidence,
      averageNetPnL,
      averageDrawdownPercent,
      averageConsistencyScore,
      recencyCoverage,
      memoryConfidence,
      decision,
      suggestedWeight,
      explanation: this.explain(decision),
    });
  }

  private classify(
    policy: HistoricalContextMemoryPolicy,
    metrics: {
      readonly usedRecords: number;
      readonly favorableRate: number;
      readonly averageDrawdownPercent: number;
      readonly averageConsistencyScore: number;
      readonly memoryConfidence: number;
      readonly blockedCount: number;
    },
  ): HistoricalContextMemoryDecision {
    if (
      metrics.averageDrawdownPercent >= policy.maxDrawdownPercentForSupport * 1.5 ||
      metrics.blockedCount > metrics.usedRecords / 2
    ) {
      return 'MEMORY_BLOCKING';
    }

    if (
      metrics.averageDrawdownPercent > policy.maxDrawdownPercentForSupport ||
      metrics.averageConsistencyScore < policy.minimumConsistencyForSupport * 0.8
    ) {
      return 'MEMORY_CAUTION';
    }

    if (
      metrics.memoryConfidence >= policy.minimumMemoryConfidenceForSupport &&
      metrics.averageConsistencyScore >= policy.minimumConsistencyForSupport &&
      metrics.favorableRate >= 0.55
    ) {
      return 'MEMORY_SUPPORTIVE';
    }

    return 'MEMORY_NEUTRAL';
  }

  private computeSuggestedWeight(
    decision: HistoricalContextMemoryDecision,
    memoryConfidence: number,
    averageDrawdownPercent: number,
  ): number {
    if (decision === 'MEMORY_SUPPORTIVE') {
      return this.clamp(1 + memoryConfidence * 0.25, 1, 1.25);
    }

    if (decision === 'MEMORY_NEUTRAL') {
      return 1;
    }

    if (decision === 'MEMORY_CAUTION') {
      return this.clamp(0.95 - averageDrawdownPercent / 100, 0.7, 0.95);
    }

    return 0.55;
  }

  private success(
    input: HistoricalContextMemoryInput,
    metrics: {
      readonly usedRecords: number;
      readonly favorableCount: number;
      readonly observeCount: number;
      readonly blockedCount: number;
      readonly favorableRate: number;
      readonly averageConfidence: number;
      readonly averageNetPnL: number;
      readonly averageDrawdownPercent: number;
      readonly averageConsistencyScore: number;
      readonly recencyCoverage: number;
      readonly memoryConfidence: number;
      readonly decision: HistoricalContextMemoryDecision;
      readonly suggestedWeight: number;
      readonly explanation: string;
    },
  ): HistoricalContextMemoryResult {
    return {
      ok: true,
      value: {
        tableId: input.tableId,
        strategyId: input.strategyId,
        totalRecords: input.records.length,
        usedRecords: metrics.usedRecords,
        favorableCount: metrics.favorableCount,
        observeCount: metrics.observeCount,
        blockedCount: metrics.blockedCount,
        favorableRate: this.roundScore(metrics.favorableRate),
        averageConfidence: this.roundScore(metrics.averageConfidence),
        averageNetPnL: this.roundMoney(metrics.averageNetPnL),
        averageDrawdownPercent: this.roundScore(metrics.averageDrawdownPercent),
        averageConsistencyScore: this.roundScore(metrics.averageConsistencyScore),
        recencyCoverage: this.roundScore(metrics.recencyCoverage),
        memoryConfidence: this.roundScore(metrics.memoryConfidence),
        decision: metrics.decision,
        suggestedWeight: this.roundScore(metrics.suggestedWeight),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: metrics.explanation,
      },
    };
  }

  private explain(decision: HistoricalContextMemoryDecision): string {
    if (decision === 'MEMORY_SUPPORTIVE') {
      return 'Histórico mesa/estratégia apoia aumento defensivo de peso contextual.';
    }

    if (decision === 'MEMORY_CAUTION') {
      return 'Histórico mesa/estratégia exige cautela e redução de peso contextual.';
    }

    if (decision === 'MEMORY_BLOCKING') {
      return 'Histórico mesa/estratégia bloqueia sugestão por drawdown ou recorrência negativa.';
    }

    return 'Histórico mesa/estratégia neutro ou insuficiente; manter peso conservador.';
  }

  private validateInput(input: HistoricalContextMemoryInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.tableId, 3, 96)) {
      return 'tableId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.strategyId, 3, 96)) {
      return 'strategyId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      return 'nowEpochMs must be a positive integer.';
    }

    if (!Array.isArray(input.records) || input.records.length > 10000) {
      return 'records must be an array with at most 10000 items.';
    }

    for (const record of input.records) {
      const recordValidation = this.validateRecord(record);

      if (recordValidation !== null) {
        return recordValidation;
      }
    }

    if (typeof input.policy !== 'object' || input.policy === null) {
      return 'policy must be provided.';
    }

    if (!Number.isInteger(input.policy.minimumRecords) || input.policy.minimumRecords < 1) {
      return 'policy.minimumRecords must be a positive integer.';
    }

    if (!Number.isInteger(input.policy.maxRecords) || input.policy.maxRecords < input.policy.minimumRecords || input.policy.maxRecords > 10000) {
      return 'policy.maxRecords must be between minimumRecords and 10000.';
    }

    if (!Number.isInteger(input.policy.recentWindowMs) || input.policy.recentWindowMs < 1) {
      return 'policy.recentWindowMs must be a positive integer.';
    }

    if (!Number.isFinite(input.policy.maxDrawdownPercentForSupport) || input.policy.maxDrawdownPercentForSupport < 0 || input.policy.maxDrawdownPercentForSupport > 100) {
      return 'policy.maxDrawdownPercentForSupport must be between 0 and 100.';
    }

    if (!this.isScore(input.policy.minimumConsistencyForSupport)) {
      return 'policy.minimumConsistencyForSupport must be between 0 and 1.';
    }

    if (!this.isScore(input.policy.minimumMemoryConfidenceForSupport)) {
      return 'policy.minimumMemoryConfidenceForSupport must be between 0 and 1.';
    }

    return null;
  }

  private validateRecord(record: HistoricalContextRecord): string | null {
    if (typeof record !== 'object' || record === null) {
      return 'each record must be an object.';
    }

    if (!this.isSafeToken(record.sessionId, 3, 96)) {
      return 'record.sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(record.tableId, 3, 96)) {
      return 'record.tableId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(record.strategyId, 3, 96)) {
      return 'record.strategyId must be a safe token with 3 to 96 characters.';
    }

    if (record.outcome !== 'FAVORAVEL' && record.outcome !== 'OBSERVAR' && record.outcome !== 'NAO_UTILIZAR') {
      return 'record.outcome is invalid.';
    }

    if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 100) {
      return 'record.confidence must be between 0 and 100.';
    }

    if (!Number.isFinite(record.netPnL)) {
      return 'record.netPnL must be finite.';
    }

    if (!Number.isFinite(record.maxDrawdownPercent) || record.maxDrawdownPercent < 0 || record.maxDrawdownPercent > 100) {
      return 'record.maxDrawdownPercent must be between 0 and 100.';
    }

    if (!this.isScore(record.consistencyScore)) {
      return 'record.consistencyScore must be between 0 and 1.';
    }

    if (!Number.isInteger(record.occurredAtEpochMs) || record.occurredAtEpochMs <= 0) {
      return 'record.occurredAtEpochMs must be a positive integer.';
    }

    return null;
  }

  private isScore(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
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

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private fail(reason: HistoricalContextMemoryReason, message: string): HistoricalContextMemoryResult {
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
