export type StrategyConfidenceDecision =
  | 'PAPER_NAO_UTILIZAR'
  | 'PAPER_OBSERVAR'
  | 'PAPER_FAVORAVEL'
  | 'PAPER_CERTIFICADO';

export type StrategyConfidenceReason =
  | 'STRATEGY_CONFIDENCE_WEIGHTED'
  | 'INVALID_STRATEGY_CONFIDENCE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface StrategyTableHistoryMetrics {
  readonly sampleSize: number;
  readonly recentHitRate: number;
  readonly recentDrawdownPercent: number;
  readonly consistencyScore: number;
  readonly volatilityScore: number;
}

export interface StrategyConfidenceInput {
  readonly strategyId: string;
  readonly tableId: string;
  readonly rawConfidence: number;
  readonly baseWeight: number;
  readonly tableHistory: StrategyTableHistoryMetrics;
  readonly readinessScore: number;
  readonly operatorScore: number;
  readonly performanceScore: number;
  readonly consensusScore: number;
  readonly minimumConfidenceForFavoravel: number;
  readonly minimumConfidenceForCertificado: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface StrategyConfidenceReport {
  readonly strategyId: string;
  readonly tableId: string;
  readonly rawConfidence: number;
  readonly dynamicWeight: number;
  readonly finalConfidence: number;
  readonly decision: StrategyConfidenceDecision;
  readonly tableHistoryWeight: number;
  readonly volatilityWeight: number;
  readonly drawdownWeight: number;
  readonly readinessWeight: number;
  readonly operatorWeight: number;
  readonly performanceWeight: number;
  readonly consensusWeight: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type StrategyConfidenceResult =
  | {
      readonly ok: true;
      readonly value: StrategyConfidenceReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: StrategyConfidenceReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * StrategyConfidenceWeightingEngine
 *
 * Calcula confiança institucional final por estratégia e mesa.
 * A saída é uma sugestão manual: PAPER_NAO_UTILIZAR, PAPER_OBSERVAR,
 * PAPER_FAVORAVEL ou PAPER_CERTIFICADO.
 *
 * Este motor não executa aposta, não controla plataforma, não autoriza dinheiro
 * real e não substitui decisão humana.
 *
 * Complexidade: O(1), memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class StrategyConfidenceWeightingEngine {
  public evaluate(input: StrategyConfidenceInput): StrategyConfidenceResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Strategy confidence weighting cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_STRATEGY_CONFIDENCE_INPUT', invalidReason);
    }

    const tableHistoryWeight = this.computeTableHistoryWeight(input.tableHistory);
    const volatilityWeight = this.computeVolatilityWeight(input.tableHistory.volatilityScore);
    const drawdownWeight = this.computeDrawdownWeight(input.tableHistory.recentDrawdownPercent);
    const readinessWeight = this.clamp(input.readinessScore, 0.5, 1.2);
    const operatorWeight = this.clamp(input.operatorScore, 0.4, 1.15);
    const performanceWeight = this.clamp(0.65 + input.performanceScore * 0.5, 0.65, 1.15);
    const consensusWeight = this.clamp(0.6 + input.consensusScore * 0.55, 0.6, 1.15);

    const dynamicWeight = this.clamp(
      input.baseWeight *
      tableHistoryWeight *
      volatilityWeight *
      drawdownWeight *
      readinessWeight *
      operatorWeight *
      performanceWeight *
      consensusWeight,
      0.25,
      1.35,
    );

    const finalConfidence = this.clamp(input.rawConfidence * dynamicWeight, 0, 100);
    const decision = this.classify(input, finalConfidence);

    return {
      ok: true,
      value: {
        strategyId: input.strategyId,
        tableId: input.tableId,
        rawConfidence: this.roundScore(input.rawConfidence),
        dynamicWeight: this.roundScore(dynamicWeight),
        finalConfidence: this.roundScore(finalConfidence),
        decision,
        tableHistoryWeight: this.roundScore(tableHistoryWeight),
        volatilityWeight: this.roundScore(volatilityWeight),
        drawdownWeight: this.roundScore(drawdownWeight),
        readinessWeight: this.roundScore(readinessWeight),
        operatorWeight: this.roundScore(operatorWeight),
        performanceWeight: this.roundScore(performanceWeight),
        consensusWeight: this.roundScore(consensusWeight),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(decision),
      },
    };
  }

  private classify(input: StrategyConfidenceInput, finalConfidence: number): StrategyConfidenceDecision {
    if (
      input.readinessScore < 0.5 ||
      input.operatorScore < 0.5 ||
      input.consensusScore < 0.5 ||
      input.tableHistory.recentDrawdownPercent >= 15
    ) {
      return 'PAPER_NAO_UTILIZAR';
    }

    if (finalConfidence >= input.minimumConfidenceForCertificado) {
      return 'PAPER_CERTIFICADO';
    }

    if (finalConfidence >= input.minimumConfidenceForFavoravel) {
      return 'PAPER_FAVORAVEL';
    }

    if (finalConfidence >= 60) {
      return 'PAPER_OBSERVAR';
    }

    return 'PAPER_NAO_UTILIZAR';
  }

  private computeTableHistoryWeight(history: StrategyTableHistoryMetrics): number {
    if (history.sampleSize < 20) {
      return 0.75;
    }

    const hitRateComponent = this.clamp(0.75 + history.recentHitRate * 0.5, 0.75, 1.2);
    const consistencyComponent = this.clamp(0.75 + history.consistencyScore * 0.45, 0.75, 1.2);

    return this.clamp((hitRateComponent + consistencyComponent) / 2, 0.75, 1.2);
  }

  private computeVolatilityWeight(volatilityScore: number): number {
    return this.clamp(1.15 - volatilityScore * 0.45, 0.65, 1.15);
  }

  private computeDrawdownWeight(drawdownPercent: number): number {
    if (drawdownPercent <= 2) {
      return 1.1;
    }

    if (drawdownPercent <= 5) {
      return 1;
    }

    if (drawdownPercent <= 10) {
      return 0.8;
    }

    if (drawdownPercent < 15) {
      return 0.6;
    }

    return 0.35;
  }

  private explain(decision: StrategyConfidenceDecision): string {
    if (decision === 'PAPER_CERTIFICADO') {
      return 'Estratégia certificada para sugestão manual PAPER nesta rodada, com decisão final humana.';
    }

    if (decision === 'PAPER_FAVORAVEL') {
      return 'Estratégia favorável para sugestão manual PAPER nesta rodada, com decisão final humana.';
    }

    if (decision === 'PAPER_OBSERVAR') {
      return 'Estratégia exige observação; aguardar evidência adicional antes de utilização manual.';
    }

    return 'Estratégia não qualificada institucionalmente para utilização manual nesta rodada.';
  }

  private validateInput(input: StrategyConfidenceInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.strategyId, 3, 96)) {
      return 'strategyId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.tableId, 3, 96)) {
      return 'tableId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isFinite(input.rawConfidence) || input.rawConfidence < 0 || input.rawConfidence > 100) {
      return 'rawConfidence must be between 0 and 100.';
    }

    if (!Number.isFinite(input.baseWeight) || input.baseWeight <= 0 || input.baseWeight > 2) {
      return 'baseWeight must be positive and up to 2.';
    }

    if (typeof input.tableHistory !== 'object' || input.tableHistory === null) {
      return 'tableHistory must be provided.';
    }

    if (!Number.isInteger(input.tableHistory.sampleSize) || input.tableHistory.sampleSize < 0 || input.tableHistory.sampleSize > 10000) {
      return 'tableHistory.sampleSize must be an integer between 0 and 10000.';
    }

    if (!this.isScore(input.tableHistory.recentHitRate)) {
      return 'tableHistory.recentHitRate must be between 0 and 1.';
    }

    if (!Number.isFinite(input.tableHistory.recentDrawdownPercent) || input.tableHistory.recentDrawdownPercent < 0 || input.tableHistory.recentDrawdownPercent > 100) {
      return 'tableHistory.recentDrawdownPercent must be between 0 and 100.';
    }

    if (!this.isScore(input.tableHistory.consistencyScore)) {
      return 'tableHistory.consistencyScore must be between 0 and 1.';
    }

    if (!this.isScore(input.tableHistory.volatilityScore)) {
      return 'tableHistory.volatilityScore must be between 0 and 1.';
    }

    if (!this.isScore(input.readinessScore)) {
      return 'readinessScore must be between 0 and 1.';
    }

    if (!this.isScore(input.operatorScore)) {
      return 'operatorScore must be between 0 and 1.';
    }

    if (!this.isScore(input.performanceScore)) {
      return 'performanceScore must be between 0 and 1.';
    }

    if (!this.isScore(input.consensusScore)) {
      return 'consensusScore must be between 0 and 1.';
    }

    if (!Number.isFinite(input.minimumConfidenceForFavoravel) || input.minimumConfidenceForFavoravel < 60 || input.minimumConfidenceForFavoravel > 100) {
      return 'minimumConfidenceForFavoravel must be between 60 and 100.';
    }

    if (!Number.isFinite(input.minimumConfidenceForCertificado) || input.minimumConfidenceForCertificado < 60 || input.minimumConfidenceForCertificado > 100) {
      return 'minimumConfidenceForCertificado must be between 60 and 100.';
    }

    if (input.minimumConfidenceForFavoravel > input.minimumConfidenceForCertificado) {
      return 'minimumConfidenceForFavoravel cannot be greater than minimumConfidenceForCertificado.';
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

  private fail(reason: StrategyConfidenceReason, message: string): StrategyConfidenceResult {
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
