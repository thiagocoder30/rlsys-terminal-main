import { describe, it, expect, vi } from 'vitest';
import { RiskGovernanceService } from '../../../src/application/governance/RiskGovernanceService';
import { IGovernancePolicy } from '../../../src/domain/contracts/IGovernancePolicy';
import { IRiskHardStopContract } from '../../../src/domain/contracts/IRiskHardStopContract';
import { IDecisionAuditLedger } from '../../../src/domain/contracts/IDecisionAuditLedger';

describe('RiskGovernanceService', () => {
  const createMockGovernancePolicy = (shouldThrow = false): IGovernancePolicy => ({
    PaperOnly: true,
    ProductionMoneyAllowed: false,
    LiveMoneyAuthorization: false,
    AutomaticBetExecutionAllowed: false,
    validateExecutionRequest: vi.fn(() => {
      if (shouldThrow) {
        throw new Error('GOVERNANCE_VIOLATION: Live operations are strictly forbidden');
      }
    })
  });

  const createMockRiskHardStop = (isDrawdownReached = false, isProfitLockReached = false): IRiskHardStopContract => ({
    MAX_DAILY_DRAWDOWN_PERCENTAGE: -15.0,
    DAILY_PROFIT_LOCK_PERCENTAGE: 25.0,
    isDrawdownLimitReached: vi.fn(() => isDrawdownReached),
    isProfitLockReached: vi.fn(() => isProfitLockReached)
  });

  const createMockAuditLedger = (): IDecisionAuditLedger => ({
    logDecision: vi.fn()
  });

  it('should authorize a valid paper trading decision', () => {
    const policy = createMockGovernancePolicy();
    const riskStop = createMockRiskHardStop();
    const ledger = createMockAuditLedger();
    const service = new RiskGovernanceService(policy, riskStop, ledger);

    const result = service.authorize({
      requestedAction: 'TEST_ACTION',
      isLiveMoney: false,
      currentDrawdown: -5,
      currentProfit: 10
    });

    expect(result).toBe('AUTHORIZED');
    expect(policy.validateExecutionRequest).toHaveBeenCalled();
    expect(ledger.logDecision).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TEST_ACTION',
      status: 'AUTHORIZED',
      reason: 'GOVERNANCE_PASSED'
    }));
  });

  it('should block if live money is requested', () => {
    const policy = createMockGovernancePolicy();
    const riskStop = createMockRiskHardStop();
    const ledger = createMockAuditLedger();
    const service = new RiskGovernanceService(policy, riskStop, ledger);

    const result = service.authorize({
      requestedAction: 'TEST_ACTION',
      isLiveMoney: true,
      currentDrawdown: -5,
      currentProfit: 10
    });

    expect(result).toBe('BLOCKED');
    expect(ledger.logDecision).toHaveBeenCalledWith(expect.objectContaining({
      status: 'BLOCKED',
      reason: 'LIVE_MONEY_ATTEMPT_REJECTED'
    }));
  });

  it('should block if drawdown limit is reached', () => {
    const policy = createMockGovernancePolicy();
    const riskStop = createMockRiskHardStop(true, false);
    const ledger = createMockAuditLedger();
    const service = new RiskGovernanceService(policy, riskStop, ledger);

    const result = service.authorize({
      requestedAction: 'TEST_ACTION',
      isLiveMoney: false,
      currentDrawdown: -16,
      currentProfit: 10
    });

    expect(result).toBe('BLOCKED');
    expect(ledger.logDecision).toHaveBeenCalledWith(expect.objectContaining({
      status: 'BLOCKED',
      reason: expect.stringContaining('MAX_DRAWDOWN_REACHED')
    }));
  });

  it('should block if profit lock is reached', () => {
    const policy = createMockGovernancePolicy();
    const riskStop = createMockRiskHardStop(false, true);
    const ledger = createMockAuditLedger();
    const service = new RiskGovernanceService(policy, riskStop, ledger);

    const result = service.authorize({
      requestedAction: 'TEST_ACTION',
      isLiveMoney: false,
      currentDrawdown: -5,
      currentProfit: 26
    });

    expect(result).toBe('BLOCKED');
    expect(ledger.logDecision).toHaveBeenCalledWith(expect.objectContaining({
      status: 'BLOCKED',
      reason: expect.stringContaining('PROFIT_LOCK_REACHED')
    }));
  });
});
