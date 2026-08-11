export interface IRiskHardStopContract {
  readonly MAX_DAILY_DRAWDOWN_PERCENTAGE: number; // e.g., -15.0
  readonly DAILY_PROFIT_LOCK_PERCENTAGE: number;  // e.g., +25.0

  isDrawdownLimitReached(currentDrawdown: number): boolean;
  isProfitLockReached(currentProfit: number): boolean;
}
