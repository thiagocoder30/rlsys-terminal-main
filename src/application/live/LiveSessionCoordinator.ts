import { SystemHealthGuard, FinancialGuard, CooldownGuard, TacticalEngine, DefenseStatus } from './IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from '../../domain/decision/DecisionContracts';

export class LiveSessionCoordinator {
  constructor(
    private readonly healthGuard: SystemHealthGuard,
    private readonly financialGuard: FinancialGuard,
    private readonly cooldownGuard: CooldownGuard,
    private readonly tacticalEngine: TacticalEngine
  ) {}

  /**
   * Ponto de entrada do sistema durante uma sessão ao vivo.
   * Complexidade: O(1). Pipeline defensivo estrito.
   */
  public processLiveSpin(liveState: CurrentLiveState, currentTimeMs: number): DecisionResult {
    try {
      // 1. Camada 0: Integridade do Sistema (Emergency Freeze)
      if (this.healthGuard.checkHealth() === DefenseStatus.BLOCKED) {
        return this.buildRejection('SYSTEM_HEALTH_COMPROMISED');
      }

      // 2. Camada 1: Proteção de Capital (Circuit Breaker / Drawdown)
      if (this.financialGuard.authorizeEntry() === DefenseStatus.BLOCKED) {
        return this.buildRejection('FINANCIAL_DRAWDOWN_OR_BREAKER_ACTIVE');
      }

      // 3. Camada 2: Proteção Psicológica (Cooldown do Operador)
      if (this.cooldownGuard.isOperatorReady(currentTimeMs) === DefenseStatus.BLOCKED) {
        return this.buildRejection('OPERATOR_IN_COOLDOWN');
      }

      // 4. Camada 3: Execução Tática (Knowledge Engine)
      // Chegando aqui, o sistema tem 100% de autorização para ler o mercado.
      return this.tacticalEngine.evaluate(liveState);

    } catch (error) {
      // Postura Institucional Fail-Closed: Qualquer excepção não tratada vira NO_GO
      return this.buildRejection('UNEXPECTED_RUNTIME_EXCEPTION');
    }
  }

  private buildRejection(reason: string): DecisionResult {
    return {
      action: ActionSignal.NO_GO,
      expectedEV: 0,
      confidence: 0,
      reason
    };
  }
}
