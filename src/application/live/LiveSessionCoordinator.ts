import { SystemHealthGuard, FinancialGuard, CooldownGuard, TacticalEngine, DefenseStatus } from './IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from '../../domain/decision/DecisionContracts';
import { PositionSizingEngine } from '../../domain/finance/PositionSizingEngine';
import { RuntimeEnforcementOrchestrator } from '../../domain/runtime/RuntimeEnforcementOrchestrator';

export class LiveSessionCoordinator {
  private readonly runtimeEnforcementOrchestrator = new RuntimeEnforcementOrchestrator();

  constructor(
    private readonly healthGuard: SystemHealthGuard,
    private readonly financialGuard: FinancialGuard,
    private readonly cooldownGuard: CooldownGuard,
    private readonly tacticalEngine: TacticalEngine
  ) {}

  public processLiveSpin(liveState: CurrentLiveState | number, currentTimeMs: number = Date.now()): DecisionResult {
    try {
      const normalizedLiveState: CurrentLiveState = typeof liveState === 'number'
        ? { dealerId: 'UNKNOWN', wheelSpeedCategory: 'NORMAL' as CurrentLiveState['wheelSpeedCategory'], targetSector: liveState }
        : liveState;
      const healthStatus = this.healthGuard.checkHealth();
      const cooldownStatus = this.cooldownGuard.isOperatorReady(currentTimeMs);
      const financialStatus = this.financialGuard.authorizeEntry();

      const enforcementResult = this.runtimeEnforcementOrchestrator.evaluate({
        dataIntegrityValid: true,
        runtimeSanityState: 'SANITY_OK',
        sessionBreakerState: 'SESSION_OPEN',
        drawdownLockState: 'DRAWDOWN_OK',
        runtimeHealthState: healthStatus === DefenseStatus.BLOCKED ? 'DOWN' : 'HEALTHY',
        cooldownActive: cooldownStatus === DefenseStatus.BLOCKED,
        financialExposureAllowed: financialStatus !== DefenseStatus.BLOCKED,
        candidateAvailable: true
      });

      if (!enforcementResult.ok) {
        return this.buildRejection(enforcementResult.error);
      }

      if (!enforcementResult.value.allowed) {
        return this.buildRejection(
          `RUNTIME_ENFORCEMENT_${enforcementResult.value.verdict}_${enforcementResult.value.reasons.join('_')}`
        );
      }

      const decision = this.tacticalEngine.evaluate(normalizedLiveState);

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

  public registerOutcome(pnl: number, currentTimeMs: number = Date.now()): void {
    this.financialGuard.registerPnL(pnl);
    if (this.financialGuard.authorizeEntry() === DefenseStatus.BLOCKED) {
      this.cooldownGuard.triggerCooldown(30 * 60 * 1000, currentTimeMs);
    }
  }

  private buildRejection(reason: string): DecisionResult {
    return { action: ActionSignal.NO_GO, expectedEV: 0, confidence: 0, reason };
  }
}
