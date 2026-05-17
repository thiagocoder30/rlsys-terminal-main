import { ActionSignal } from '../../domain/decision/DecisionContracts';

export interface SpinTelemetryData {
  readonly timestampMs: number;
  readonly dealerId: string;
  readonly wheelSpeed: string;
  readonly targetSector: number;
  readonly action: ActionSignal;
  readonly expectedEV: number;
  readonly confidence: number;
  readonly recommendedUnits: number;
  readonly pnl: number;
  readonly latencyMs: number;
}

export interface SessionTelemetryLogger {
  logSpin(data: SpinTelemetryData): void;
}
