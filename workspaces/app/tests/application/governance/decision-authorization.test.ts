import { describe, it, expect, vi } from 'vitest';
import { RiskGovernanceService } from '../../../src/application/governance/RiskGovernanceService';
import { IGovernancePolicy } from '../../../src/domain/contracts/IGovernancePolicy';
import { IRiskHardStopContract } from '../../../src/domain/contracts/IRiskHardStopContract';
import { IDecisionAuditLedger } from '../../../src/domain/contracts/IDecisionAuditLedger';

describe('DecisionAuthorization Contract Fulfillment', () => {
  it('should block execution if the underlying policy strictly forbids it (exception thrown)', () => {
    const policy: IGovernancePolicy = {
      PaperOnly: true,
      ProductionMoneyAllowed: false,
      LiveMoneyAuthorization: false,
      AutomaticBetExecutionAllowed: false,
      validateExecutionRequest: vi.fn(() => {
        throw new Error('GOVERNANCE_VIOLATION: Strict policy failure');
      })
    };
    
    const riskStop: IRiskHardStopContract = {
      MAX_DAILY_DRAWDOWN_PERCENTAGE: -15.0,
      DAILY_PROFIT_LOCK_PERCENTAGE: 25.0,
      isDrawdownLimitReached: vi.fn(() => false),
      isProfitLockReached: vi.fn(() => false)
    };

    const ledger: IDecisionAuditLedger = {
      logDecision: vi.fn()
    };

    const service = new RiskGovernanceService(policy, riskStop, ledger);

    const result = service.authorize({
      requestedAction: 'CRITICAL_ACTION',
      isLiveMoney: false,
      currentDrawdown: -1,
      currentProfit: 1
    });

    expect(result).toBe('BLOCKED');
    expect(ledger.logDecision).toHaveBeenCalledWith(expect.objectContaining({
      status: 'BLOCKED',
      reason: 'GOVERNANCE_VIOLATION: Strict policy failure'
    }));
  });
});
