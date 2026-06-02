export type PaperPerformanceOutcome = 'WIN' | 'LOSS' | 'PUSH';

export type PaperPerformanceDecision =
  | 'PAPER_PERFORMANCE_HEALTHY'
  | 'PAPER_PERFORMANCE_OBSERVE'
  | 'PAPER_PERFORMANCE_BLOCKED';

export type PaperPerformanceCertificationImpact =
  | 'CERTIFICATION_SUPPORTIVE'
  | 'CERTIFICATION_NEEDS_REVIEW'
  | 'CERTIFICATION_BLOCKING';

export type PaperPerformanceReason =
  | 'PAPER_PERFORMANCE_ANALYZED'
  | 'INVALID_PAPER_PERFORMANCE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperPerformanceTrade {
  readonly tradeId: string;
  readonly outcome: PaperPerformanceOutcome;
  readonly stake: number;
  readonly pnl: number;
  readonly closedAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperPerformancePolicy {
  readonly minimumTrades: number;
  readonly maxDrawdownPercent: number;
  readonly minimumConsistencyScore: number;
  readonly minimumExpectancy: number;
  readonly minimumRecoveryFactor: number;
}

export interface PaperPerformanceAnalyzerInput {
  readonly sessionId: string;
  readonly initialBalance: number;
  readonly trades: readonly PaperPerformanceTrade[];
  readonly policy: PaperPerformancePolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperPerformanceReport {
  readonly sessionId: string;
  readonly totalTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly hitRate: number;
  readonly averageWin: number;
  readonly averageLoss: number;
  readonly payoffRatio: number;
  readonly expectancy: number;
  readonly netPnL: number;
  readonly maxDrawdown: number;
  readonly maxDrawdownPercent: number;
  readonly recoveryFactor: number;
  readonly consistencyScore: number;
  readonly decision: PaperPerformanceDecision;
  readonly certificationImpact: PaperPerformanceCertificationImpact;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperPerformanceAnalyzerResult =
  | {
      readonly ok: true;
      readonly value: PaperPerformanceReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperPerformanceReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;
const SCORE_PRECISION = 10_000;

/**
 * PaperPerformanceAnalyzer
 *
 * Analisa performance PAPER finalizada usando métricas institucionais:
 * expectancy, hit rate, payoff ratio, max drawdown, recovery factor e
 * consistency score.
 *
 * Este componente não abre apostas, não opera live money e não altera sessão
 * ativa. Ele apenas avalia histórico PAPER já encerrado.
 *
 * Complexidade: O(n), com memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class PaperPerformanceAnalyzer {
  public analyze(input: PaperPerformanceAnalyzerInput): PaperPerformanceAnalyzerResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper performance analysis cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.trades)) {
      for (const trade of input.trades) {
        if (trade.productionMoneyAllowed === true || trade.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper performance trade cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_PERFORMANCE_INPUT', invalidReason);
    }

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let grossWin = 0;
    let grossLossAbs = 0;
    let netPnL = 0;
    let balance = input.initialBalance;
    let peakBalance = input.initialBalance;
    let maxDrawdown = 0;
    let previousClosedAt = 0;
    let stableTransitions = 0;
    let previousSign: 'WIN' | 'LOSS' | 'PUSH' | 'NONE' = 'NONE';

    for (const trade of input.trades) {
      if (trade.closedAtEpochMs < previousClosedAt) {
        return this.fail('INVALID_PAPER_PERFORMANCE_INPUT', 'trades must be ordered by closedAtEpochMs.');
      }

      previousClosedAt = trade.closedAtEpochMs;

      if (trade.outcome === 'WIN') {
        wins += 1;
        grossWin += Math.max(0, trade.pnl);
      } else if (trade.outcome === 'LOSS') {
        losses += 1;
        grossLossAbs += Math.abs(Math.min(0, trade.pnl));
      } else {
        pushes += 1;
      }

      netPnL += trade.pnl;
      balance += trade.pnl;

      if (balance > peakBalance) {
        peakBalance = balance;
      }

      const drawdown = Math.max(0, peakBalance - balance);

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      const currentSign = trade.outcome;

      if (previousSign !== 'NONE' && !(previousSign === 'LOSS' && currentSign === 'LOSS')) {
        stableTransitions += 1;
      }

      previousSign = currentSign;
    }

    const totalTrades = input.trades.length;
    const hitRate = wins / totalTrades;
    const lossRate = losses / totalTrades;
    const averageWin = wins > 0 ? grossWin / wins : 0;
    const averageLoss = losses > 0 ? grossLossAbs / losses : 0;
    const payoffRatio = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? averageWin : 0;
    const expectancy = (hitRate * averageWin) - (lossRate * averageLoss);
    const maxDrawdownPercent = input.initialBalance > 0 ? (maxDrawdown / input.initialBalance) * 100 : 0;
    const recoveryFactor = maxDrawdown > 0 ? netPnL / maxDrawdown : netPnL > 0 ? netPnL : 0;
    const consistencyScore = totalTrades <= 1 ? 1 : stableTransitions / (totalTrades - 1);

    const decision = this.classify(input.policy, {
      totalTrades,
      expectancy,
      maxDrawdownPercent,
      recoveryFactor,
      consistencyScore,
    });

    return {
      ok: true,
      value: {
        sessionId: input.sessionId,
        totalTrades,
        wins,
        losses,
        pushes,
        hitRate: this.roundScore(hitRate),
        averageWin: this.roundMoney(averageWin),
        averageLoss: this.roundMoney(averageLoss),
        payoffRatio: this.roundScore(payoffRatio),
        expectancy: this.roundMoney(expectancy),
        netPnL: this.roundMoney(netPnL),
        maxDrawdown: this.roundMoney(maxDrawdown),
        maxDrawdownPercent: this.roundScore(maxDrawdownPercent),
        recoveryFactor: this.roundScore(recoveryFactor),
        consistencyScore: this.roundScore(consistencyScore),
        decision,
        certificationImpact: this.mapCertificationImpact(decision),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(decision),
      },
    };
  }

  private classify(
    policy: PaperPerformancePolicy,
    metrics: {
      readonly totalTrades: number;
      readonly expectancy: number;
      readonly maxDrawdownPercent: number;
      readonly recoveryFactor: number;
      readonly consistencyScore: number;
    },
  ): PaperPerformanceDecision {
    if (
      metrics.totalTrades < policy.minimumTrades ||
      metrics.maxDrawdownPercent > policy.maxDrawdownPercent
    ) {
      return 'PAPER_PERFORMANCE_BLOCKED';
    }

    if (
      metrics.expectancy < policy.minimumExpectancy ||
      metrics.recoveryFactor < policy.minimumRecoveryFactor ||
      metrics.consistencyScore < policy.minimumConsistencyScore
    ) {
      return 'PAPER_PERFORMANCE_OBSERVE';
    }

    return 'PAPER_PERFORMANCE_HEALTHY';
  }

  private mapCertificationImpact(decision: PaperPerformanceDecision): PaperPerformanceCertificationImpact {
    if (decision === 'PAPER_PERFORMANCE_HEALTHY') {
      return 'CERTIFICATION_SUPPORTIVE';
    }

    if (decision === 'PAPER_PERFORMANCE_OBSERVE') {
      return 'CERTIFICATION_NEEDS_REVIEW';
    }

    return 'CERTIFICATION_BLOCKING';
  }

  private explain(decision: PaperPerformanceDecision): string {
    if (decision === 'PAPER_PERFORMANCE_HEALTHY') {
      return 'Performance PAPER saudável para apoiar certificação institucional.';
    }

    if (decision === 'PAPER_PERFORMANCE_OBSERVE') {
      return 'Performance PAPER requer observação antes de apoiar certificação.';
    }

    return 'Performance PAPER bloqueada por amostra insuficiente ou drawdown acima da política.';
  }

  private validateInput(input: PaperPerformanceAnalyzerInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isFinite(input.initialBalance) || input.initialBalance <= 0) {
      return 'initialBalance must be a positive finite number.';
    }

    if (!Array.isArray(input.trades) || input.trades.length === 0 || input.trades.length > 5000) {
      return 'trades must contain 1 to 5000 paper trades.';
    }

    for (const trade of input.trades) {
      const tradeValidation = this.validateTrade(trade);

      if (tradeValidation !== null) {
        return tradeValidation;
      }
    }

    if (typeof input.policy !== 'object' || input.policy === null) {
      return 'policy must be provided.';
    }

    if (!Number.isInteger(input.policy.minimumTrades) || input.policy.minimumTrades < 1) {
      return 'policy.minimumTrades must be a positive integer.';
    }

    if (!Number.isFinite(input.policy.maxDrawdownPercent) || input.policy.maxDrawdownPercent < 0) {
      return 'policy.maxDrawdownPercent must be a non-negative finite number.';
    }

    if (!Number.isFinite(input.policy.minimumConsistencyScore) || input.policy.minimumConsistencyScore < 0 || input.policy.minimumConsistencyScore > 1) {
      return 'policy.minimumConsistencyScore must be between 0 and 1.';
    }

    if (!Number.isFinite(input.policy.minimumExpectancy)) {
      return 'policy.minimumExpectancy must be finite.';
    }

    if (!Number.isFinite(input.policy.minimumRecoveryFactor)) {
      return 'policy.minimumRecoveryFactor must be finite.';
    }

    return null;
  }

  private validateTrade(trade: PaperPerformanceTrade): string | null {
    if (typeof trade !== 'object' || trade === null) {
      return 'each trade must be an object.';
    }

    if (!this.isSafeToken(trade.tradeId, 3, 96)) {
      return 'trade.tradeId must be a safe token with 3 to 96 characters.';
    }

    if (trade.outcome !== 'WIN' && trade.outcome !== 'LOSS' && trade.outcome !== 'PUSH') {
      return 'trade.outcome must be WIN, LOSS, or PUSH.';
    }

    if (!Number.isFinite(trade.stake) || trade.stake <= 0) {
      return 'trade.stake must be a positive finite number.';
    }

    if (!Number.isFinite(trade.pnl)) {
      return 'trade.pnl must be finite.';
    }

    if (trade.outcome === 'WIN' && trade.pnl <= 0) {
      return 'WIN trade must have positive pnl.';
    }

    if (trade.outcome === 'LOSS' && trade.pnl >= 0) {
      return 'LOSS trade must have negative pnl.';
    }

    if (trade.outcome === 'PUSH' && trade.pnl !== 0) {
      return 'PUSH trade must have zero pnl.';
    }

    if (!Number.isInteger(trade.closedAtEpochMs) || trade.closedAtEpochMs <= 0) {
      return 'trade.closedAtEpochMs must be a positive integer.';
    }

    return null;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private fail(reason: PaperPerformanceReason, message: string): PaperPerformanceAnalyzerResult {
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
