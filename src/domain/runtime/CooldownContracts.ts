export enum CooldownReason {
  STOP_LOSS = 'STOP_LOSS',
  DRAWDOWN_VELOCITY = 'DRAWDOWN_VELOCITY',
  PARADIGM_BREAK = 'PARADIGM_BREAK',
  MANUAL_EMERGENCY = 'MANUAL_EMERGENCY'
}

export interface CooldownPolicy {
  readonly stopLossMs: number;
  readonly drawdownVelocityMs: number;
  readonly paradigmBreakMs: number;
  readonly manualEmergencyMs: number;
}

export interface CooldownStatus {
  readonly isActive: boolean;
  readonly remainingMs: number;
  readonly reason: CooldownReason | null;
}

// Novo: Interface de Estado para Persistência
export interface CooldownState {
  readonly lockTimestampMs: number;
  readonly activeReason: CooldownReason;
  readonly requiredDurationMs: number;
}

// Novo: Contrato de Repositório (Inversão de Dependência)
export interface CooldownStateRepository {
  save(state: CooldownState): void;
  load(): CooldownState | null;
  clear(): void;
}
