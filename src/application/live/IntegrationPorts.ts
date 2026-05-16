import { CurrentLiveState, DecisionResult } from '../../domain/decision/DecisionContracts';

// Enumeração global de estados defensivos
export enum DefenseStatus {
  CLEAR = 'CLEAR',
  BLOCKED = 'BLOCKED'
}

export interface SystemHealthGuard {
  checkHealth(): DefenseStatus;
}

export interface FinancialGuard {
  authorizeEntry(): DefenseStatus;
}

export interface CooldownGuard {
  isOperatorReady(currentTimeMs: number): DefenseStatus;
}

export interface TacticalEngine {
  evaluate(liveState: CurrentLiveState): DecisionResult;
}
