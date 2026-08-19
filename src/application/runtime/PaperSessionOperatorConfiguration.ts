import type {
  OperatorRiskMode,
} from '../../domain/risk/OperatorRiskProfile.js';

export type PaperOperatorProvider =
  | 'PRAGMATIC'
  | 'EVOLUTION';

export type PaperSessionOperatorConfigurationStatus =
  | 'PENDING'
  | 'CONFIGURED';

export interface PaperSessionOperatorConfigurationInput {
  readonly sessionId: string;
  readonly bankroll: number;
  readonly provider: PaperOperatorProvider;
  readonly operatorId?: string;
  readonly riskMode: OperatorRiskMode;
  readonly allowMartingale: boolean;
}

export interface PaperSessionOperatorConfigurationSnapshot {
  readonly status:
    PaperSessionOperatorConfigurationStatus;

  readonly sessionId: string;

  readonly bankroll: number;

  readonly provider:
    PaperOperatorProvider;

  readonly minimumChipValue: number;

  readonly operatorId?: string;

  readonly riskMode:
    OperatorRiskMode;

  readonly allowMartingale: boolean;
}

/**
 * Owns operator-controlled PAPER session configuration.
 *
 * This component does not:
 * - calculate risk profile;
 * - calculate stake;
 * - qualify table history;
 * - authorize runtime;
 * - authorize live money.
 *
 * It only validates and stores explicit operator configuration.
 *
 * Complexity:
 * - Time: O(1)
 * - Memory: O(1)
 */
export class PaperSessionOperatorConfiguration {
  private snapshot:
    PaperSessionOperatorConfigurationSnapshot | null =
      null;

  public configure(
    input: PaperSessionOperatorConfigurationInput,
  ): PaperSessionOperatorConfigurationSnapshot {
    this.validate(input);

    const snapshot =
      Object.freeze({
        status: 'CONFIGURED' as const,

        sessionId:
          input.sessionId.trim(),

        bankroll:
          this.money(input.bankroll),

        provider:
          input.provider,

        minimumChipValue:
          this.minimumChipValue(
            input.provider,
          ),

        operatorId:
          this.optionalText(
            input.operatorId,
          ),

        riskMode:
          input.riskMode,

        allowMartingale:
          input.allowMartingale,
      });

    this.snapshot = snapshot;

    return snapshot;
  }

  public current():
    PaperSessionOperatorConfigurationSnapshot | null {
    return this.snapshot;
  }

  private validate(
    input: PaperSessionOperatorConfigurationInput,
  ): void {
    if (
      typeof input.sessionId !== 'string' ||
      input.sessionId.trim().length === 0
    ) {
      throw new Error(
        'paper_session_invalid_session_id',
      );
    }

    if (
      !Number.isFinite(input.bankroll) ||
      input.bankroll <= 0
    ) {
      throw new Error(
        'paper_session_invalid_bankroll',
      );
    }

    if (
      input.provider !== 'PRAGMATIC' &&
      input.provider !== 'EVOLUTION'
    ) {
      throw new Error(
        'paper_session_invalid_provider',
      );
    }

    if (
      input.riskMode !== 'CONSERVATIVE' &&
      input.riskMode !== 'MODERATE' &&
      input.riskMode !== 'AGGRESSIVE'
    ) {
      throw new Error(
        'paper_session_invalid_risk_mode',
      );
    }

    if (
      typeof input.allowMartingale !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_invalid_martingale_policy',
      );
    }
  }

  private minimumChipValue(
    provider: PaperOperatorProvider,
  ): number {
    if (provider === 'EVOLUTION') {
      return 0.50;
    }

    return 0.10;
  }

  private optionalText(
    value?: string,
  ): string | undefined {
    if (
      typeof value !== 'string'
    ) {
      return undefined;
    }

    const normalized =
      value.trim();

    return normalized.length > 0
      ? normalized
      : undefined;
  }

  private money(
    value: number,
  ): number {
    return Math.round(
      value * 100,
    ) / 100;
  }
}
