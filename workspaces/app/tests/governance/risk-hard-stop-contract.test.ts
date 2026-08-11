import { describe, it, expect } from 'vitest';
import { IRiskHardStopContract } from '../../src/domain/contracts/IRiskHardStopContract';

class MockRiskHardStop implements IRiskHardStopContract {
  public readonly MAX_DAILY_DRAWDOWN_PERCENTAGE = -15.0;
  public readonly DAILY_PROFIT_LOCK_PERCENTAGE = 25.0;

  isDrawdownLimitReached(currentDrawdown: number): boolean {
    return currentDrawdown <= this.MAX_DAILY_DRAWDOWN_PERCENTAGE;
  }

  isProfitLockReached(currentProfit: number): boolean {
    return currentProfit >= this.DAILY_PROFIT_LOCK_PERCENTAGE;
  }
}

describe('Risk Hard Stop Contract', () => {
  it('must define -15% as the maximum daily drawdown limit', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.MAX_DAILY_DRAWDOWN_PERCENTAGE).toBe(-15.0);
  });

  it('must define +25% as the daily profit lock limit', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.DAILY_PROFIT_LOCK_PERCENTAGE).toBe(25.0);
  });

  it('should block operations when drawdown hits exactly -15%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isDrawdownLimitReached(-15.0)).toBe(true);
  });

  it('should block operations when drawdown goes below -15%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isDrawdownLimitReached(-16.0)).toBe(true);
  });

  it('should allow operations when drawdown is above -15%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isDrawdownLimitReached(-14.9)).toBe(false);
  });

  it('should block operations when profit hits exactly +25%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isProfitLockReached(25.0)).toBe(true);
  });

  it('should block operations when profit goes above +25%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isProfitLockReached(26.0)).toBe(true);
  });

  it('should allow operations when profit is below +25%', () => {
    const riskStop = new MockRiskHardStop();
    expect(riskStop.isProfitLockReached(24.9)).toBe(false);
  });
});
