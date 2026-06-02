export type AdaptiveCalibrationDecision =
  | 'CALIBRATION_BOOSTED'
  | 'CALIBRATION_STABLE'
  | 'CALIBRATION_REDUCED'
  | 'CALIBRATION_BLOCKED';

export type AdaptiveCalibrationReason =
  | 'ADAPTIVE_CONFIDENCE_CALIBRATED'
  | 'INVALID_ADAPTIVE_CONFIDENCE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface AdaptiveConfidenceCalibrationInput {
  readonly strategyId: string;
  readonly tableId: string;
  readonly baseConfidence: number;
  readonly strategyReputationDecision: string;
  readonly strategySuggestedWeight: number;
  readonly tableReputationDecision: string;
  readonly tableSuggestedWeight: number;
  readonly crossSessionDecision: string;
  readonly crossSessionSuggestedWeight: number;
  readonly trendDirection: string;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface AdaptiveConfidenceCalibrationReport {
  readonly strategyId: string;
  readonly tableId: string;
  readonly baseConfidence: number;
  readonly calibratedConfidence: number;
  readonly calibrationDelta: number;
  readonly institutionalWeight: number;
  readonly decision: AdaptiveCalibrationDecision;
  readonly reasons: readonly string[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type AdaptiveConfidenceCalibrationResult =
  | {
      readonly ok: true;
      readonly value: AdaptiveConfidenceCalibrationReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: AdaptiveCalibrationReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * AdaptiveConfidenceCalibrationEngine
 *
 * Calibra a confiança operacional usando aprendizado institucional:
 * reputação da estratégia, reputação da mesa, inteligência entre sessões,
 * tendência temporal, operador e consenso.
 *
 * Não executa aposta, não automatiza plataforma e não autoriza live money.
 * A saída é apenas confiança calibrada para sugestão manual PAPER.
 *
 * Complexidade O(1), memória O(1).
 */
export class AdaptiveConfidenceCalibrationEngine {
  public calibrate(input: AdaptiveConfidenceCalibrationInput): AdaptiveConfidenceCalibrationResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Adaptive confidence calibration cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_ADAPTIVE_CONFIDENCE_INPUT', invalidReason);
    }

    if (
      this.isBlocking(input.strategyReputationDecision) ||
      this.isBlocking(input.tableReputationDecision) ||
      this.isBlocking(input.crossSessionDecision) ||
      this.isBlocking(input.trendDirection) ||
      this.isBlocking(input.operatorStatus) ||
      this.isBlocking(input.consensusDecision)
    ) {
      return {
        ok: true,
        value: {
          strategyId: input.strategyId,
          tableId: input.tableId,
          baseConfidence: this.roundScore(input.baseConfidence),
          calibratedConfidence: 0,
          calibrationDelta: this.roundScore(-input.baseConfidence),
          institutionalWeight: 0,
          decision: 'CALIBRATION_BLOCKED',
          reasons: [
            'Bloqueio institucional detectado.',
            'Confiança zerada para impedir sugestão manual nesta rodada.',
          ],
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
        },
      };
    }

    const strategyFactor = this.factorFromDecision(input.strategyReputationDecision, input.strategySuggestedWeight);
    const tableFactor = this.factorFromDecision(input.tableReputationDecision, input.tableSuggestedWeight);
    const crossFactor = this.factorFromDecision(input.crossSessionDecision, input.crossSessionSuggestedWeight);
    const trendFactor = this.trendFactor(input.trendDirection);
    const operatorFactor = this.operatorFactor(input.operatorStatus);
    const consensusFactor = this.consensusFactor(input.consensusDecision);

    const institutionalWeight = this.clamp(
      strategyFactor * 0.22 +
      tableFactor * 0.18 +
      crossFactor * 0.22 +
      trendFactor * 0.16 +
      operatorFactor * 0.10 +
      consensusFactor * 0.12,
      0.50,
      1.25,
    );

    const calibratedConfidence = this.clamp(input.baseConfidence * institutionalWeight, 0, 99);
    const calibrationDelta = calibratedConfidence - input.baseConfidence;

    return {
      ok: true,
      value: {
        strategyId: input.strategyId,
        tableId: input.tableId,
        baseConfidence: this.roundScore(input.baseConfidence),
        calibratedConfidence: this.roundScore(calibratedConfidence),
        calibrationDelta: this.roundScore(calibrationDelta),
        institutionalWeight: this.roundScore(institutionalWeight),
        decision: this.classify(calibrationDelta),
        reasons: this.reasons(input, institutionalWeight, calibrationDelta),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private factorFromDecision(decision: string, suggestedWeight: number): number {
    if (decision.includes('STRONG')) return this.clamp(suggestedWeight, 1.05, 1.25);
    if (decision.includes('STABLE')) return this.clamp(suggestedWeight, 1.00, 1.12);
    if (decision.includes('NEUTRAL')) return 1;
    if (decision.includes('CAUTION') || decision.includes('VOLATILE') || decision.includes('DEGRADING')) return 0.82;
    return this.clamp(suggestedWeight, 0.75, 1.15);
  }

  private trendFactor(direction: string): number {
    if (direction === 'TREND_IMPROVING') return 1.12;
    if (direction === 'TREND_STABLE') return 1;
    if (direction === 'TREND_DEGRADING') return 0.82;
    if (direction === 'TREND_INSUFFICIENT') return 0.95;
    return 0.75;
  }

  private operatorFactor(status: string): number {
    if (status.includes('STABLE') || status.includes('APT')) return 1.05;
    if (status.includes('COOLDOWN')) return 0.82;
    if (status.includes('REVIEW')) return 0.9;
    return 1;
  }

  private consensusFactor(decision: string): number {
    if (decision.includes('CERTIFIED')) return 1.08;
    if (decision.includes('READY')) return 1.03;
    if (decision.includes('OBSERVE')) return 0.88;
    return 1;
  }

  private classify(delta: number): AdaptiveCalibrationDecision {
    if (delta >= 2) return 'CALIBRATION_BOOSTED';
    if (delta <= -2) return 'CALIBRATION_REDUCED';
    return 'CALIBRATION_STABLE';
  }

  private reasons(input: AdaptiveConfidenceCalibrationInput, weight: number, delta: number): readonly string[] {
    return [
      `Estratégia ${input.strategyId}: ${input.strategyReputationDecision}`,
      `Mesa ${input.tableId}: ${input.tableReputationDecision}`,
      `Cross-session: ${input.crossSessionDecision}`,
      `Tendência: ${input.trendDirection}`,
      `Operador: ${input.operatorStatus}`,
      `Consenso: ${input.consensusDecision}`,
      `Peso institucional: ${this.roundScore(weight)}`,
      `Delta de confiança: ${this.roundScore(delta)}`,
      'Uso permitido apenas como sugestão manual PAPER.',
    ];
  }

  private isBlocking(value: string): boolean {
    return value.includes('BLOCK') || value.includes('NAO_UTILIZAR');
  }

  private validateInput(input: AdaptiveConfidenceCalibrationInput): string | null {
    if (typeof input !== 'object' || input === null) return 'input must be an object.';
    if (!this.isSafeToken(input.strategyId, 3, 96)) return 'strategyId must be a safe token.';
    if (!this.isSafeToken(input.tableId, 3, 96)) return 'tableId must be a safe token.';
    if (!Number.isFinite(input.baseConfidence) || input.baseConfidence < 0 || input.baseConfidence > 100) return 'baseConfidence must be between 0 and 100.';

    if (!this.isMeaningful(input.strategyReputationDecision)) return 'strategyReputationDecision must be meaningful.';
    if (!this.isWeight(input.strategySuggestedWeight)) return 'strategySuggestedWeight must be between 0 and 2.';
    if (!this.isMeaningful(input.tableReputationDecision)) return 'tableReputationDecision must be meaningful.';
    if (!this.isWeight(input.tableSuggestedWeight)) return 'tableSuggestedWeight must be between 0 and 2.';
    if (!this.isMeaningful(input.crossSessionDecision)) return 'crossSessionDecision must be meaningful.';
    if (!this.isWeight(input.crossSessionSuggestedWeight)) return 'crossSessionSuggestedWeight must be between 0 and 2.';
    if (!this.isMeaningful(input.trendDirection)) return 'trendDirection must be meaningful.';
    if (!this.isMeaningful(input.operatorStatus)) return 'operatorStatus must be meaningful.';
    if (!this.isMeaningful(input.consensusDecision)) return 'consensusDecision must be meaningful.';

    return null;
  }

  private isWeight(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 2;
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

  private fail(reason: AdaptiveCalibrationReason, message: string): AdaptiveConfidenceCalibrationResult {
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
