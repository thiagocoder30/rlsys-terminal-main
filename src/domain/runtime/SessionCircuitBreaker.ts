export enum SessionStatus {
  SESSION_OPEN = 'SESSION_OPEN',
  SESSION_REVIEW = 'SESSION_REVIEW',
  SESSION_LOCKED = 'SESSION_LOCKED',
  SESSION_PROFIT_LOCKED = 'SESSION_PROFIT_LOCKED',
  BLOCKED = 'BLOCKED'
}

export type SanityEngineState = 'HEALTHY' | 'DIVERGENT' | 'PARADIGM_BREAK';

export interface SessionState {
  readonly initialBankroll: number;
  readonly currentBankroll: number;
  readonly stopLossThreshold: number;
  readonly stopWinThreshold: number;
  readonly drawdownVelocityAlert: boolean;
  readonly sanityEngineState: SanityEngineState;
  readonly dataIntegrityValid: boolean;
  readonly mandatoryCooldownActive: boolean;
}

export class SessionCircuitBreaker {
  public static evaluate(state: SessionState): SessionStatus {
    if (!state.dataIntegrityValid || state.mandatoryCooldownActive) return SessionStatus.BLOCKED;
    if (state.sanityEngineState === 'PARADIGM_BREAK') return SessionStatus.SESSION_LOCKED;
    
    const diff = state.currentBankroll - state.initialBankroll;
    if (diff <= (state.stopLossThreshold * -1)) return SessionStatus.SESSION_LOCKED;
    if (diff >= state.stopWinThreshold) return SessionStatus.SESSION_PROFIT_LOCKED;
    
    if (state.drawdownVelocityAlert || state.sanityEngineState === 'DIVERGENT') {
      return SessionStatus.SESSION_REVIEW;
    }
    return SessionStatus.SESSION_OPEN;
  }
}
