import { DefenseStatus, TacticalEngine, SystemHealthGuard, FinancialGuard, CooldownGuard } from '../../application/live/IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from '../../domain/decision/DecisionContracts';
import { DecisionLookupEngine } from '../../domain/decision/DecisionLookupEngine';
import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

/**
 * Adapter para o Motor de Decisão O(1).
 * Carrega o Snapshot em RAM e cumpre o contrato do TacticalEngine.
 */
export class TacticalEngineAdapter implements TacticalEngine {
  constructor(private readonly activeSnapshot: KnowledgeSnapshot) {}

  public evaluate(liveState: CurrentLiveState): DecisionResult {
    return DecisionLookupEngine.evaluate(liveState, this.activeSnapshot);
  }
}

/**
 * Mocks/Adapters de segurança (Substituem implementações profundas por razões de arquitetura unificada)
 * Num ambiente real de produção, estes fariam as chamadas às Sprints 031-034.
 */
export class StandardHealthGuard implements SystemHealthGuard {
  public checkHealth(): DefenseStatus {
    // Aqui conectariamos ao Emergency Freeze (OCR/Câmera)
    return DefenseStatus.CLEAR;
  }
}

export class StandardFinancialGuard implements FinancialGuard {
  public authorizeEntry(): DefenseStatus {
    // Aqui conectariamos ao Circuit Breaker e Drawdown Monitor
    return DefenseStatus.CLEAR;
  }
}

export class StandardCooldownGuard implements CooldownGuard {
  public isOperatorReady(currentTimeMs: number): DefenseStatus {
    // Aqui conectariamos ao OperatorCooldownGuard e FileCooldownStateRepository
    return DefenseStatus.CLEAR;
  }
}
