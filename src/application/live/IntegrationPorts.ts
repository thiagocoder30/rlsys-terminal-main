import { CurrentLiveState, DecisionResult } from '../../domain/decision/DecisionContracts';

export enum DefenseStatus {
  CLEAR = 'CLEAR',
  BLOCKED = 'BLOCKED'
}

export interface SystemHealthGuard {
  checkHealth(): DefenseStatus;
}

export interface FinancialGuard {
  authorizeEntry(): DefenseStatus;
  registerPnL(amount: number): void;
  getConsecutiveLosses(): number;
}

export interface CooldownGuard {
  isOperatorReady(currentTimeMs: number): DefenseStatus;
  triggerCooldown(durationMs: number, currentTimeMs: number): void;
}

export interface TacticalEngine {
  evaluate(liveState: CurrentLiveState): DecisionResult;
}
