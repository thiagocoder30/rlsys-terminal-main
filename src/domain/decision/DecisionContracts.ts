export enum ActionSignal {
  NO_GO = 'NO_GO',
  OBSERVE = 'OBSERVE',
  SIGNAL = 'SIGNAL'
}

export interface CurrentLiveState {
  readonly dealerId: string;
  readonly wheelSpeedCategory: 'SLOW' | 'NORMAL' | 'FAST' | 'ANY';
  readonly targetSector: number;
}

export interface DecisionResult {
  readonly action: ActionSignal;
  readonly expectedEV: number;
  readonly confidence: number;
  readonly reason: string;
}
