export type PaperRecoveryFinancialSettlement =
  | 'WIN'
  | 'LOSS'
  | 'ZERO_LOSS'
  | 'NO_EXPOSURE';


export interface PaperRecoveryLedgerSnapshot {
  readonly pendingLossDebt:
    number;

  readonly accumulatedLosses:
    number;

  readonly recoveredAmount:
    number;

  readonly exposedSettlements:
    number;

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Session-level recovery ledger.
 *
 * Loss debt is financial, not strategy-specific.
 *
 * FOLLOWED losses from Triplicação, Fusion or any future strategy
 * may therefore contribute to the same controlled recovery budget.
 *
 * IGNORED / NOT EXECUTED recommendations must call NO_EXPOSURE and
 * never alter this ledger.
 */
export class PaperRecoveryLedger {
  private pendingLossDebtValue =
    0;

  private accumulatedLossesValue =
    0;

  private recoveredAmountValue =
    0;

  private exposedSettlementsValue =
    0;


  public apply(
    input: {
      readonly settlement:
        PaperRecoveryFinancialSettlement;

      readonly stake:
        number;

      /**
       * Recovery component that had been added above normal base stake.
       *
       * On WIN, only this amount repays historical debt.
       */
      readonly recoveryComponent?:
        number;
    },
  ): PaperRecoveryLedgerSnapshot {
    this.validateStake(
      input.stake,
    );

    const recoveryComponent =
      input.recoveryComponent ??
      0;

    if (
      !Number.isFinite(
        recoveryComponent,
      ) ||
      recoveryComponent < 0
    ) {
      throw new Error(
        'paper_recovery_ledger_invalid_recovery_component',
      );
    }

    if (
      input.settlement ===
      'NO_EXPOSURE'
    ) {
      return this.snapshot();
    }

    this.exposedSettlementsValue +=
      1;

    if (
      input.settlement ===
        'LOSS' ||
      input.settlement ===
        'ZERO_LOSS'
    ) {
      this.pendingLossDebtValue =
        this.money(
          this.pendingLossDebtValue +
          input.stake,
        );

      this.accumulatedLossesValue =
        this.money(
          this.accumulatedLossesValue +
          input.stake,
        );

      return this.snapshot();
    }

    if (
      input.settlement ===
      'WIN'
    ) {
      const recoverable =
        Math.min(
          this.pendingLossDebtValue,
          recoveryComponent,
        );

      this.pendingLossDebtValue =
        this.money(
          Math.max(
            0,
            this.pendingLossDebtValue -
            recoverable,
          ),
        );

      this.recoveredAmountValue =
        this.money(
          this.recoveredAmountValue +
          recoverable,
        );

      return this.snapshot();
    }

    throw new Error(
      'paper_recovery_ledger_invalid_settlement',
    );
  }


  public snapshot():
    PaperRecoveryLedgerSnapshot {
    return Object.freeze({
      pendingLossDebt:
        this.pendingLossDebtValue,

      accumulatedLosses:
        this.accumulatedLossesValue,

      recoveredAmount:
        this.recoveredAmountValue,

      exposedSettlements:
        this.exposedSettlementsValue,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private validateStake(
    stake:
      number,
  ): void {
    if (
      !Number.isFinite(
        stake,
      ) ||
      stake < 0
    ) {
      throw new Error(
        'paper_recovery_ledger_invalid_stake',
      );
    }
  }


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) / 100;
  }
}
