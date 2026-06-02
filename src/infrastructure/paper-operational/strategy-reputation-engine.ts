export type StrategyReputationOutcome =
  | 'PAPER_FAVORAVEL'
  | 'PAPER_OBSERVAR'
  | 'PAPER_NAO_UTILIZAR';

export type StrategyReputationDecision =
  | 'REPUTATION_STRONG'
  | 'REPUTATION_STABLE'
  | 'REPUTATION_NEUTRAL'
  | 'REPUTATION_CAUTION'
  | 'REPUTATION_BLOCKING';

export type StrategyReputationReason =
  | 'STRATEGY_REPUTATION_ANALYZED'
  | 'INVALID_STRATEGY_REPUTATION_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface StrategyReputationRecord {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly outcome: StrategyReputationOutcome;
  readonly confidence: number;
  readonly finalConfidence: number;
  readonly netPnL: number;
  readonly maxDrawdownPercent: number;
  readonly operatorStable: boolean;
  readonly consensusSupport: boolean;
  readonly occurredAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface StrategyReputationPolicy {
  readonly minimumRecords: number;
  readonly maxRecords: number;
  readonly recentWindowMs: number;
  readonly minimumStableRate: number;
  readonly minimumSupportRate: number;
  readonly maxDrawdownPercentForStable: number;
  readonly blockingDrawdownPercent: number;
}

export interface StrategyReputationInput {
  readonly strategyId: string;
  readonly nowEpochMs: number;
  readonly records: readonly StrategyReputationRecord[];
  readonly policy: StrategyReputationPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface StrategyReputationReport {
  readonly strategyId: string;
  readonly totalRecords: number;
  readonly usedRecords: number;
  readonly favorableCount: number;
  readonly observeCount: number;
  readonly blockedCount: number;
  readonly favorableRate: number;
  readonly stableOperatorRate: number;
  readonly consensusSupportRate: number;
  readonly averageConfidence: number;
  readonly averageFinalConfidence: number;
  readonly averageNetPnL: number;
  readonly averageDrawdownPercent: number;
  readonly recencyCoverage: number;
  readonly reputationScore: number;
  readonly suggestedWeight: number;
  readonly decision: StrategyReputationDecision;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type StrategyReputationResult =
  | {
      readonly ok: true;
      readonly value: StrategyReputationReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: StrategyReputationReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * StrategyReputationEngine
 *
 * Calcula reputação institucional global de uma estratégia com base em sessões
 * PAPER encerradas. Não executa aposta, não controla plataforma e não altera
 * sessão ativa.
 *
 * O objetivo é gerar peso defensivo de confiança para estratégias como Fusion
 * e Triplicação, preservando decisão humana.
 *
 * Complexidade: O(n), memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class StrategyReputationEngine {
  public evaluate(input: StrategyReputationInput): StrategyReputationResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Strategy reputation cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.records)) {
      for (const record of input.records) {
        if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Strategy reputation record cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_STRATEGY_REPUTATION_INPUT', invalidReason);
    }

    let usedRecords = 0;
    let favorableCount = 0;
    let observeCount = 0;
    let blockedCount = 0;
    let stableOperatorCount = 0;
    let consensusSupportCount = 0;
    let confidenceSum = 0;
    let finalConfidenceSum = 0;
    let netPnLSum = 0;
    let drawdownSum = 0;
    let recentCount = 0;

    const startIndex = Math.max(0, input.records.length - input.policy.maxRecords);

    for (let index = startIndex; index < input.records.length; index += 1) {
      const record = input.records[index];

      if (record.strategyId !== input.strategyId) {
        continue;
      }

      usedRecords += 1;
      confidenceSum += record.confidence;
      finalConfidenceSum += record.finalConfidence;
      netPnLSum += record.netPnL;
      drawdownSum += record.maxDrawdownPercent;

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

      if (record.consensusSupport) {
        consensusSupportCount += 1;
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
        stableOperatorRate: 0,
        consensusSupportRate: 0,
        favorableRate: 0,
        averageConfidence: 0,
        averageFinalConfidence: 0,
        averageNetPnL: 0,
        averageDrawdownPercent: 0,
        recencyCoverage: 0,
        reputationScore: 0.5,
        suggestedWeight: 1,
        decision: 'REPUTATION_NEUTRAL',
        explanation: 'Reputação insuficiente; manter peso neutro para evitar overfitting.',
      });
    }

    const favorableRate = favorableCount / usedRecords;
    const stableOperatorRate = stableOperatorCount / usedRecords;
    const consensusSupportRate = consensusSupportCount / usedRecords;
    const averageConfidence = confidenceSum / usedRecords;
    const averageFinalConfidence = finalConfidenceSum / usedRecords;
    const averageNetPnL = netPnLSum / usedRecords;
    const averageDrawdownPercent = drawdownSum / usedRecords;
    const recencyCoverage = recentCount / usedRecords;
    const sampleConfidence = this.clamp(usedRecords / Math.max(1, input.policy.maxRecords), 0, 1);

    const drawdownHealth = this.clamp(1 - (averageDrawdownPercent / Math.max(1, input.policy.blockingDrawdownPercent)), 0, 1);

    const reputationScore = this.clamp(
      favorableRate * 0.25 +
      stableOperatorRate * 0.15 +
      consensusSupportRate * 0.20 +
      (averageFinalConfidence / 100) * 0.20 +
      drawdownHealth * 0.10 +
      recencyCoverage * 0.05 +
      sampleConfidence * 0.05,
      0,
      1,
    );

    const decision = this.classify(input.policy, {
      reputationScore,
      favorableRate,
      stableOperatorRate,
      consensusSupportRate,
      averageDrawdownPercent,
      blockedCount,
      usedRecords,
    });

    const suggestedWeight = this.computeWeight(decision, reputationScore, averageDrawdownPercent);

    return this.success(input, {
      usedRecords,
      favorableCount,
      observeCount,
      blockedCount,
      favorableRate,
      stableOperatorRate,
      consensusSupportRate,
      averageConfidence,
      averageFinalConfidence,
      averageNetPnL,
      averageDrawdownPercent,
      recencyCoverage,
      reputationScore,
      suggestedWeight,
      decision,
      explanation: this.explain(decision),
    });
  }

  private classify(
    policy: StrategyReputationPolicy,
    metrics: {
      readonly reputationScore: number;
      readonly favorableRate: number;
      readonly stableOperatorRate: number;
      readonly consensusSupportRate: number;
      readonly averageDrawdownPercent: number;
      readonly blockedCount: number;
      readonly usedRecords: number;
    },
  ): StrategyReputationDecision {
    if (
      metrics.averageDrawdownPercent >= policy.blockingDrawdownPercent ||
      metrics.blockedCount > metrics.usedRecords / 2
    ) {
      return 'REPUTATION_BLOCKING';
    }

    if (
      metrics.averageDrawdownPercent > policy.maxDrawdownPercentForStable ||
      metrics.stableOperatorRate < policy.minimumStableRate * 0.8 ||
      metrics.consensusSupportRate < policy.minimumSupportRate * 0.8
    ) {
      return 'REPUTATION_CAUTION';
    }

    if (
      metrics.reputationScore >= 0.78 &&
      metrics.favorableRate >= 0.65 &&
      metrics.stableOperatorRate >= policy.minimumStableRate &&
      metrics.consensusSupportRate >= policy.minimumSupportRate
    ) {
      return 'REPUTATION_STRONG';
    }

    if (
      metrics.reputationScore >= 0.62 &&
      metrics.favorableRate >= 0.55
    ) {
      return 'REPUTATION_STABLE';
    }

    return 'REPUTATION_NEUTRAL';
  }

  private computeWeight(
    decision: StrategyReputationDecision,
    reputationScore: number,
    averageDrawdownPercent: number,
  ): number {
    if (decision === 'REPUTATION_STRONG') {
      return this.clamp(1.1 + reputationScore * 0.2, 1.1, 1.3);
    }

    if (decision === 'REPUTATION_STABLE') {
      return this.clamp(1 + reputationScore * 0.12, 1, 1.15);
    }

    if (decision === 'REPUTATION_NEUTRAL') {
      return 1;
    }

    if (decision === 'REPUTATION_CAUTION') {
      return this.clamp(0.9 - averageDrawdownPercent / 100, 0.65, 0.9);
    }

    return 0.5;
  }

  private success(
    input: StrategyReputationInput,
    metrics: {
      readonly usedRecords: number;
      readonly favorableCount: number;
      readonly observeCount: number;
      readonly blockedCount: number;
      readonly favorableRate: number;
      readonly stableOperatorRate: number;
      readonly consensusSupportRate: number;
      readonly averageConfidence: number;
      readonly averageFinalConfidence: number;
      readonly averageNetPnL: number;
      readonly averageDrawdownPercent: number;
      readonly recencyCoverage: number;
      readonly reputationScore: number;
      readonly suggestedWeight: number;
      readonly decision: StrategyReputationDecision;
      readonly explanation: string;
    },
  ): StrategyReputationResult {
    return {
      ok: true,
      value: {
        strategyId: input.strategyId,
        totalRecords: input.records.length,
        usedRecords: metrics.usedRecords,
        favorableCount: metrics.favorableCount,
        observeCount: metrics.observeCount,
        blockedCount: metrics.blockedCount,
        favorableRate: this.roundScore(metrics.favorableRate),
        stableOperatorRate: this.roundScore(metrics.stableOperatorRate),
        consensusSupportRate: this.roundScore(metrics.consensusSupportRate),
        averageConfidence: this.roundScore(metrics.averageConfidence),
        averageFinalConfidence: this.roundScore(metrics.averageFinalConfidence),
        averageNetPnL: this.roundMoney(metrics.averageNetPnL),
        averageDrawdownPercent: this.roundScore(metrics.averageDrawdownPercent),
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

  private explain(decision: StrategyReputationDecision): string {
    if (decision === 'REPUTATION_STRONG') {
      return 'Estratégia possui reputação institucional forte para aumentar peso defensivo.';
    }

    if (decision === 'REPUTATION_STABLE') {
      return 'Estratégia possui reputação estável para leve suporte contextual.';
    }

    if (decision === 'REPUTATION_CAUTION') {
      return 'Estratégia exige cautela por histórico inconsistente ou drawdown elevado.';
    }

    if (decision === 'REPUTATION_BLOCKING') {
      return 'Estratégia bloqueada por reputação negativa recorrente.';
    }

    return 'Estratégia com reputação neutra; manter peso padrão.';
  }

  private validateInput(input: StrategyReputationInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
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

    if (!this.isScore(input.policy.minimumStableRate)) {
      return 'policy.minimumStableRate must be between 0 and 1.';
    }

    if (!this.isScore(input.policy.minimumSupportRate)) {
      return 'policy.minimumSupportRate must be between 0 and 1.';
    }

    if (!Number.isFinite(input.policy.maxDrawdownPercentForStable) || input.policy.maxDrawdownPercentForStable < 0 || input.policy.maxDrawdownPercentForStable > 100) {
      return 'policy.maxDrawdownPercentForStable must be between 0 and 100.';
    }

    if (!Number.isFinite(input.policy.blockingDrawdownPercent) || input.policy.blockingDrawdownPercent < input.policy.maxDrawdownPercentForStable || input.policy.blockingDrawdownPercent > 100) {
      return 'policy.blockingDrawdownPercent must be between maxDrawdownPercentForStable and 100.';
    }

    return null;
  }

  private validateRecord(record: StrategyReputationRecord): string | null {
    if (typeof record !== 'object' || record === null) {
      return 'each record must be an object.';
    }

    if (!this.isSafeToken(record.sessionId, 3, 96)) {
      return 'record.sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(record.strategyId, 3, 96)) {
      return 'record.strategyId must be a safe token with 3 to 96 characters.';
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

    if (!Number.isFinite(record.finalConfidence) || record.finalConfidence < 0 || record.finalConfidence > 100) {
      return 'record.finalConfidence must be between 0 and 100.';
    }

    if (!Number.isFinite(record.netPnL)) {
      return 'record.netPnL must be finite.';
    }

    if (!Number.isFinite(record.maxDrawdownPercent) || record.maxDrawdownPercent < 0 || record.maxDrawdownPercent > 100) {
      return 'record.maxDrawdownPercent must be between 0 and 100.';
    }

    if (typeof record.operatorStable !== 'boolean') {
      return 'record.operatorStable must be boolean.';
    }

    if (typeof record.consensusSupport !== 'boolean') {
      return 'record.consensusSupport must be boolean.';
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

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private fail(reason: StrategyReputationReason, message: string): StrategyReputationResult {
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
