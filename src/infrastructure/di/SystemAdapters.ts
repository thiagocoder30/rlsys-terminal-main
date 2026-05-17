import { DefenseStatus, TacticalEngine, SystemHealthGuard, FinancialGuard, CooldownGuard } from '../../application/live/IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from '../../domain/decision/DecisionContracts';
import { PhysicsTacticalEngine } from '../../domain/decision/PhysicsTacticalEngine';
import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

export class TacticalEngineAdapter implements TacticalEngine {
  private readonly engine: PhysicsTacticalEngine;
  constructor(activeSnapshot: KnowledgeSnapshot) {
    this.engine = new PhysicsTacticalEngine(activeSnapshot);
  }

  public evaluate(liveState: CurrentLiveState): DecisionResult {
    return this.engine.evaluate(liveState);
  }
}

export class StandardHealthGuard implements SystemHealthGuard {
  public checkHealth(): DefenseStatus { return DefenseStatus.CLEAR; }
}
