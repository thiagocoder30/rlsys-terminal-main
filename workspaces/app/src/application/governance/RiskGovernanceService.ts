import { IDecisionAuthorizationService, DecisionRequest, DecisionAuthorizationResult } from '../contracts/IDecisionAuthorizationService';
import { IGovernancePolicy } from '../../domain/contracts/IGovernancePolicy';
import { IRiskHardStopContract } from '../../domain/contracts/IRiskHardStopContract';
import { IDecisionAuditLedger } from '../../domain/contracts/IDecisionAuditLedger';

export class RiskGovernanceService implements IDecisionAuthorizationService {
  constructor(
    private readonly governancePolicy: IGovernancePolicy,
    private readonly riskHardStop: IRiskHardStopContract,
    private readonly auditLedger: IDecisionAuditLedger
  ) {}

  public authorize(request: DecisionRequest): DecisionAuthorizationResult {
    try {
      // 1. Validate Live Money Policy
      if (request.isLiveMoney) {
        this.auditLedger.logDecision({
          action: request.requestedAction,
          status: 'BLOCKED',
          reason: 'LIVE_MONEY_ATTEMPT_REJECTED',
          timestamp: new Date().toISOString()
        });
        return 'BLOCKED';
      }

      // 2. Enforce Paper Only Policy
      this.governancePolicy.validateExecutionRequest();

      // 3. Check Hard Stops
      if (this.riskHardStop.isDrawdownLimitReached(request.currentDrawdown)) {
        this.auditLedger.logDecision({
          action: request.requestedAction,
          status: 'BLOCKED',
          reason: `MAX_DRAWDOWN_REACHED: ${request.currentDrawdown}%`,
          timestamp: new Date().toISOString()
        });
        return 'BLOCKED';
      }

      if (this.riskHardStop.isProfitLockReached(request.currentProfit)) {
        this.auditLedger.logDecision({
          action: request.requestedAction,
          status: 'BLOCKED',
          reason: `PROFIT_LOCK_REACHED: ${request.currentProfit}%`,
          timestamp: new Date().toISOString()
        });
        return 'BLOCKED';
      }

      // 4. Authorized
      this.auditLedger.logDecision({
        action: request.requestedAction,
        status: 'AUTHORIZED',
        reason: 'GOVERNANCE_PASSED',
        timestamp: new Date().toISOString()
      });
      return 'AUTHORIZED';

    } catch (error) {
      // In case governancePolicy.validateExecutionRequest() throws
      this.auditLedger.logDecision({
        action: request.requestedAction,
        status: 'BLOCKED',
        reason: error instanceof Error ? error.message : 'UNKNOWN_GOVERNANCE_VIOLATION',
        timestamp: new Date().toISOString()
      });
      return 'BLOCKED';
    }
  }
}
