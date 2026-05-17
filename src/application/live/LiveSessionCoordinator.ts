import { SystemHealthGuard, FinancialGuard, CooldownGuard, TacticalEngine, DefenseStatus } from './IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from '../../domain/decision/DecisionContracts';
import { PositionSizingEngine } from '../../domain/finance/PositionSizingEngine';

export class LiveSessionCoordinator {
  constructor(
    private readonly healthGuard: SystemHealthGuard,
    private readonly financialGuard: FinancialGuard,
    private readonly cooldownGuard: CooldownGuard,
    private readonly tacticalEngine: TacticalEngine
  ) {}

  public processLiveSpin(liveState: CurrentLiveState, currentTimeMs: number): DecisionResult {
    try {
      if (this.healthGuard.checkHealth() === DefenseStatus.BLOCKED) return this.buildRejection('SYSTEM_HEALTH_COMPROMISED');
      if (this.cooldownGuard.isOperatorReady(currentTimeMs) === DefenseStatus.BLOCKED) return this.buildRejection('OPERATOR_IN_COOLDOWN');
      if (this.financialGuard.authorizeEntry() === DefenseStatus.BLOCKED) return this.buildRejection('FINANCIAL_DRAWDOWN_ACTIVE');

      const decision = this.tacticalEngine.evaluate(liveState);

      // Injeção da Inteligência Financeira
      if (decision.action === ActionSignal.SIGNAL) {
        const losses = this.financialGuard.getConsecutiveLosses();
        const units = PositionSizingEngine.calculateUnits(decision.expectedEV, decision.confidence, losses);
        return { ...decision, recommendedUnits: units };
      }

      return decision;
    } catch (error) {
      return this.buildRejection('UNEXPECTED_RUNTIME_EXCEPTION');
    }
  }

  public registerOutcome(pnl: number, currentTimeMs: number): void {
    this.financialGuard.registerPnL(pnl);
    if (this.financialGuard.authorizeEntry() === DefenseStatus.BLOCKED) {
      this.cooldownGuard.triggerCooldown(30 * 60 * 1000, currentTimeMs);
    }
  }

  private buildRejection(reason: string): DecisionResult {
    return { action: ActionSignal.NO_GO, expectedEV: 0, confidence: 0, reason };
  }
}
