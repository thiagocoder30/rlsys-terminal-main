export type PaperLedgerRuntimeEventType = 'WIN' | 'LOSS';

export interface PaperLedgerRuntimeState {
  readonly initialBalance: number;
  readonly currentBalance: number;
  readonly sessionPnl: number;
  readonly highWaterMark: number;
  readonly drawdown: number;
  readonly wins: number;
  readonly losses: number;
  readonly lastEventType: PaperLedgerRuntimeEventType | null;
  readonly lastAmount: number;
}

export interface PaperLedgerRuntimeEvent {
  readonly type: PaperLedgerRuntimeEventType;
  readonly amount: number;
}

export interface PaperLedgerRuntimeApplyResult {
  readonly accepted: boolean;
  readonly state: PaperLedgerRuntimeState;
  readonly reason: string;
}

/**
 * O(1) runtime paper ledger state service.
 *
 * It does not load historical events. Each event updates only the current
 * bounded state needed by HUD, risk gateway, reporting and operator guidance.
 */
export class PaperLedgerRuntimeService {
  private state: PaperLedgerRuntimeState;

  public constructor(initialBalance: number) {
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      throw new Error('initialBalance must be a positive finite number');
    }

    const balance = this.money(initialBalance);

    this.state = {
      initialBalance: balance,
      currentBalance: balance,
      sessionPnl: 0,
      highWaterMark: balance,
      drawdown: 0,
      wins: 0,
      losses: 0,
      lastEventType: null,
      lastAmount: 0,
    };
  }

  public snapshot(): PaperLedgerRuntimeState {
    return this.state;
  }

  public apply(event: PaperLedgerRuntimeEvent): PaperLedgerRuntimeApplyResult {
    this.assertEvent(event);

    const signedAmount = event.type === 'WIN' ? event.amount : -event.amount;
    const currentBalance = this.money(this.state.currentBalance + signedAmount);
    const highWaterMark = this.money(Math.max(this.state.highWaterMark, currentBalance));
    const drawdown = this.money(Math.max(0, highWaterMark - currentBalance));

    this.state = {
      initialBalance: this.state.initialBalance,
      currentBalance,
      sessionPnl: this.money(currentBalance - this.state.initialBalance),
      highWaterMark,
      drawdown,
      wins: this.state.wins + (event.type === 'WIN' ? 1 : 0),
      losses: this.state.losses + (event.type === 'LOSS' ? 1 : 0),
      lastEventType: event.type,
      lastAmount: this.money(event.amount),
    };

    return {
      accepted: true,
      state: this.state,
      reason: event.type === 'WIN'
        ? 'paper win registered'
        : 'paper loss registered',
    };
  }

  private assertEvent(event: PaperLedgerRuntimeEvent): void {
    if (event.type !== 'WIN' && event.type !== 'LOSS') {
      throw new Error('event.type must be WIN or LOSS');
    }

    if (!Number.isFinite(event.amount) || event.amount <= 0) {
      throw new Error('event.amount must be a positive finite number');
    }

    if (event.type === 'LOSS' && event.amount > this.state.currentBalance) {
      throw new Error('loss amount cannot exceed current balance');
    }
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
