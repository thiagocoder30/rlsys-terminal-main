export type TableReputationOutcome =
  | 'PAPER_FAVORAVEL'
  | 'PAPER_OBSERVAR'
  | 'PAPER_NAO_UTILIZAR';

export type TableReputationDecision =
  | 'TABLE_REPUTATION_STRONG'
  | 'TABLE_REPUTATION_STABLE'
  | 'TABLE_REPUTATION_NEUTRAL'
  | 'TABLE_REPUTATION_VOLATILE'
  | 'TABLE_REPUTATION_BLOCKING';

export type TableReputationReason =
  | 'TABLE_REPUTATION_ANALYZED'
  | 'INVALID_TABLE_REPUTATION_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface TableReputationRecord {
  readonly sessionId: string;
  readonly tableId: string;
  readonly outcome: TableReputationOutcome;
  readonly confidence: number;
  readonly consensusScore: number;
  readonly volatilityScore: number;
  readonly maxDrawdownPercent: number;
  readonly strategyDiversity: number;
  readonly operatorStable: boolean;
  readonly occurredAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface TableReputationPolicy {
  readonly minimumRecords: number;
  readonly maxRecords: number;
  readonly recentWindowMs: number;
  readonly maxVolatilityForStable: number;
  readonly maxDrawdownPercentForStable: number;
  readonly blockingDrawdownPercent: number;
  readonly minimumConsensusSupport: number;
}

export interface TableReputationInput {
  readonly tableId: string;
  readonly nowEpochMs: number;
  readonly records: readonly TableReputationRecord[];
  readonly policy: TableReputationPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface TableReputationReport {
  readonly tableId: string;
  readonly totalRecords: number;
  readonly usedRecords: number;
  readonly favorableCount: number;
  readonly observeCount: number;
  readonly blockedCount: number;
  readonly favorableRate: number;
  readonly averageConfidence: number;
  readonly averageConsensusScore: number;
  readonly averageVolatilityScore: number;
  readonly averageDrawdownPercent: number;
  readonly averageStrategyDiversity: number;
  readonly stableOperatorRate: number;
  readonly recencyCoverage: number;
  readonly reputationScore: number;
  readonly suggestedWeight: number;
  readonly decision: TableReputationDecision;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type TableReputationResult =
  | {
      readonly ok: true;
      readonly value: TableReputationReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: TableReputationReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * TableReputationEngine
 *
 * Avalia reputação institucional da mesa independentemente da estratégia.
 * A reputação da mesa complementa StrategyReputationEngine e
 * HistoricalContextMemoryEngine, separando "estratégia boa" de "mesa boa".
 *
 * Não executa apostas, não opera live money e não altera sessão ativa.
 *
 * Complexidade: O(n), memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class TableReputationEngine {
  public evaluate(input: TableReputationInput): TableReputationResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Table reputation cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.records)) {
      for (const record of input.records) {
        if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Table reputation record cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_TABLE_REPUTATION_INPUT', invalidReason);
    }

    let usedRecords = 0;
    let favorableCount = 0;
    let observeCount = 0;
    let blockedCount = 0;
    let confidenceSum = 0;
    let consensusSum = 0;
    let volatilitySum = 0;
    let drawdownSum = 0;
    let diversitySum = 0;
    let stableOperatorCount = 0;
    let recentCount = 0;

    const startIndex = Math.max(0, input.records.length - input.policy.maxRecords);

    for (let index = startIndex; index < input.records.length; index += 1) {
      const record = input.records[index];

      if (record.tableId !== input.tableId) {
        continue;
      }

      usedRecords += 1;
      confidenceSum += record.confidence;
      consensusSum += record.consensusScore;
      volatilitySum += record.volatilityScore;
      drawdownSum += record.maxDrawdownPercent;
      diversitySum += record.strategyDiversity;

      if (record.outcome === 'PAPER_FAVORAVEL') {
        favorableCount += 1;
      } else if (record.outcome === 'PAPER_OBSERVAR') {
        observeCount += 1;
      } else {
        blockedCount += 1;
      }

      if (record.operatorStable) {
        stableOperatorCount += 1;
      }

      if (input.nowEpochMs - record.occurredAtEpochMs <= input.policy.recentWindowMs) {
        recentCount += 1;
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
        averageConsensusScore: 0,
        averageVolatilityScore: 0,
        averageDrawdownPercent: 0,
        averageStrategyDiversity: 0,
        stableOperatorRate: 0,
        recencyCoverage: 0,
        reputationScore: 0.5,
        suggestedWeight: 1,
        decision: 'TABLE_REPUTATION_NEUTRAL',
        explanation: 'Reputação da mesa insuficiente; manter peso neutro.',
      });
    }

    const favorableRate = favorableCount / usedRecords;
    const averageConfidence = confidenceSum / usedRecords;
    const averageConsensusScore = consensusSum / usedRecords;
    const averageVolatilityScore = volatilitySum / usedRecords;
    const averageDrawdownPercent = drawdownSum / usedRecords;
    const averageStrategyDiversity = diversitySum / usedRecords;
    const stableOperatorRate = stableOperatorCount / usedRecords;
    const recencyCoverage = recentCount / usedRecords;
    const sampleConfidence = this.clamp(usedRecords / Math.max(1, input.policy.maxRecords), 0, 1);
    const volatilityHealth = this.clamp(1 - averageVolatilityScore, 0, 1);
    const drawdownHealth = this.clamp(1 - averageDrawdownPercent / Math.max(1, input.policy.blockingDrawdownPercent), 0, 1);

    const reputationScore = this.clamp(
      favorableRate * 0.20 +
      (averageConfidence / 100) * 0.15 +
      averageConsensusScore * 0.20 +
      volatilityHealth * 0.15 +
      drawdownHealth * 0.10 +
      averageStrategyDiversity * 0.05 +
      stableOperatorRate * 0.05 +
      recencyCoverage * 0.05 +
      sampleConfidence * 0.05,
      0,
      1,
    );

    const decision = this.classify(input.policy, {
      usedRecords,
      favorableRate,
      averageConsensusScore,
      averageVolatilityScore,
      averageDrawdownPercent,
      blockedCount,
      reputationScore,
    });

    const suggestedWeight = this.computeWeight(decision, reputationScore, averageVolatilityScore, averageDrawdownPercent);

    return this.success(input, {
      usedRecords,
      favorableCount,
      observeCount,
      blockedCount,
      favorableRate,
      averageConfidence,
      averageConsensusScore,
      averageVolatilityScore,
      averageDrawdownPercent,
      averageStrategyDiversity,
      stableOperatorRate,
      recencyCoverage,
      reputationScore,
      suggestedWeight,
      decision,
      explanation: this.explain(decision),
    });
  }

  private classify(
    policy: TableReputationPolicy,
    metrics: {
      readonly usedRecords: number;
      readonly favorableRate: number;
      readonly averageConsensusScore: number;
      readonly averageVolatilityScore: number;
      readonly averageDrawdownPercent: number;
      readonly blockedCount: number;
      readonly reputationScore: number;
    },
  ): TableReputationDecision {
    if (
      metrics.averageDrawdownPercent >= policy.blockingDrawdownPercent ||
      metrics.blockedCount > metrics.usedRecords / 2
    ) {
      return 'TABLE_REPUTATION_BLOCKING';
    }

    if (
      metrics.averageVolatilityScore > policy.maxVolatilityForStable * 1.25 ||
      metrics.averageDrawdownPercent > policy.maxDrawdownPercentForStable
    ) {
      return 'TABLE_REPUTATION_VOLATILE';
    }

    if (
      metrics.reputationScore >= 0.72 &&
      metrics.favorableRate >= 0.60 &&
      metrics.averageConsensusScore >= policy.minimumConsensusSupport &&
      metrics.averageVolatilityScore <= policy.maxVolatilityForStable
    ) {
      return 'TABLE_REPUTATION_STRONG';
    }

    if (
      metrics.reputationScore >= 0.62 &&
      metrics.averageConsensusScore >= policy.minimumConsensusSupport * 0.85
    ) {
      return 'TABLE_REPUTATION_STABLE';
    }

    return 'TABLE_REPUTATION_NEUTRAL';
  }

  private computeWeight(
    decision: TableReputationDecision,
    reputationScore: number,
    averageVolatilityScore: number,
    averageDrawdownPercent: number,
  ): number {
    if (decision === 'TABLE_REPUTATION_STRONG') {
      return this.clamp(1.08 + reputationScore * 0.18, 1.08, 1.25);
    }

    if (decision === 'TABLE_REPUTATION_STABLE') {
      return this.clamp(1 + reputationScore * 0.10, 1, 1.12);
    }

    if (decision === 'TABLE_REPUTATION_NEUTRAL') {
      return 1;
    }

    if (decision === 'TABLE_REPUTATION_VOLATILE') {
      return this.clamp(0.95 - averageVolatilityScore * 0.35 - averageDrawdownPercent / 200, 0.6, 0.95);
    }

    return 0.5;
  }

  private success(
    input: TableReputationInput,
    metrics: {
      readonly usedRecords: number;
      readonly favorableCount: number;
      readonly observeCount: number;
      readonly blockedCount: number;
      readonly favorableRate: number;
      readonly averageConfidence: number;
      readonly averageConsensusScore: number;
      readonly averageVolatilityScore: number;
      readonly averageDrawdownPercent: number;
      readonly averageStrategyDiversity: number;
      readonly stableOperatorRate: number;
      readonly recencyCoverage: number;
      readonly reputationScore: number;
      readonly suggestedWeight: number;
      readonly decision: TableReputationDecision;
      readonly explanation: string;
    },
  ): TableReputationResult {
    return {
      ok: true,
      value: {
        tableId: input.tableId,
        totalRecords: input.records.length,
        usedRecords: metrics.usedRecords,
        favorableCount: metrics.favorableCount,
        observeCount: metrics.observeCount,
        blockedCount: metrics.blockedCount,
        favorableRate: this.roundScore(metrics.favorableRate),
        averageConfidence: this.roundScore(metrics.averageConfidence),
        averageConsensusScore: this.roundScore(metrics.averageConsensusScore),
        averageVolatilityScore: this.roundScore(metrics.averageVolatilityScore),
        averageDrawdownPercent: this.roundScore(metrics.averageDrawdownPercent),
        averageStrategyDiversity: this.roundScore(metrics.averageStrategyDiversity),
        stableOperatorRate: this.roundScore(metrics.stableOperatorRate),
        recencyCoverage: this.roundScore(metrics.recencyCoverage),
        reputationScore: this.roundScore(metrics.reputationScore),
        suggestedWeight: this.roundScore(metrics.suggestedWeight),
        decision: metrics.decision,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: metrics.explanation,
      },
    };
  }

  private explain(decision: TableReputationDecision): string {
    if (decision === 'TABLE_REPUTATION_STRONG') {
      return 'Mesa possui reputação institucional forte para apoiar sugestão manual PAPER.';
    }

    if (decision === 'TABLE_REPUTATION_STABLE') {
      return 'Mesa possui reputação estável para leve suporte contextual.';
    }

    if (decision === 'TABLE_REPUTATION_VOLATILE') {
      return 'Mesa exige cautela por volatilidade ou drawdown acima do padrão.';
    }

    if (decision === 'TABLE_REPUTATION_BLOCKING') {
      return 'Mesa bloqueada por histórico institucional negativo.';
    }

    return 'Mesa com reputação neutra; manter peso padrão.';
  }

  private validateInput(input: TableReputationInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.tableId, 3, 96)) {
      return 'tableId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      return 'nowEpochMs must be a positive integer.';
    }

    if (!Array.isArray(input.records) || input.records.length > 10000) {
      return 'records must be an array with at most 10000 items.';
    }

    for (const record of input.records) {
      const validation = this.validateRecord(record);

      if (validation !== null) {
        return validation;
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
      return 'policy.recentWindowMs must be positive.';
    }

    if (!this.isScore(input.policy.maxVolatilityForStable)) {
      return 'policy.maxVolatilityForStable must be between 0 and 1.';
    }

    if (!Number.isFinite(input.policy.maxDrawdownPercentForStable) || input.policy.maxDrawdownPercentForStable < 0 || input.policy.maxDrawdownPercentForStable > 100) {
      return 'policy.maxDrawdownPercentForStable must be between 0 and 100.';
    }

    if (!Number.isFinite(input.policy.blockingDrawdownPercent) || input.policy.blockingDrawdownPercent < input.policy.maxDrawdownPercentForStable || input.policy.blockingDrawdownPercent > 100) {
      return 'policy.blockingDrawdownPercent must be between maxDrawdownPercentForStable and 100.';
    }

    if (!this.isScore(input.policy.minimumConsensusSupport)) {
      return 'policy.minimumConsensusSupport must be between 0 and 1.';
    }

    return null;
  }

  private validateRecord(record: TableReputationRecord): string | null {
    if (typeof record !== 'object' || record === null) {
      return 'each record must be an object.';
    }

    if (!this.isSafeToken(record.sessionId, 3, 96)) {
      return 'record.sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(record.tableId, 3, 96)) {
      return 'record.tableId must be a safe token with 3 to 96 characters.';
    }

    if (
      record.outcome !== 'PAPER_FAVORAVEL' &&
      record.outcome !== 'PAPER_OBSERVAR' &&
      record.outcome !== 'PAPER_NAO_UTILIZAR'
    ) {
      return 'record.outcome is invalid.';
    }

    if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 100) {
      return 'record.confidence must be between 0 and 100.';
    }

    if (!this.isScore(record.consensusScore)) {
      return 'record.consensusScore must be between 0 and 1.';
    }

    if (!this.isScore(record.volatilityScore)) {
      return 'record.volatilityScore must be between 0 and 1.';
    }

    if (!Number.isFinite(record.maxDrawdownPercent) || record.maxDrawdownPercent < 0 || record.maxDrawdownPercent > 100) {
      return 'record.maxDrawdownPercent must be between 0 and 100.';
    }

    if (!this.isScore(record.strategyDiversity)) {
      return 'record.strategyDiversity must be between 0 and 1.';
    }

    if (typeof record.operatorStable !== 'boolean') {
      return 'record.operatorStable must be boolean.';
    }

    if (!Number.isInteger(record.occurredAtEpochMs) || record.occurredAtEpochMs <= 0) {
      return 'record.occurredAtEpochMs must be positive integer.';
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

  private fail(reason: TableReputationReason, message: string): TableReputationResult {
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
