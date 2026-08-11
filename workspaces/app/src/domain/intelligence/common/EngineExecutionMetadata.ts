export type EngineExecutionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface EngineExecutionMetadata {
  readonly durationMs: number;
  readonly version: string;
  readonly algorithmName: string;
  readonly status: EngineExecutionStatus;
  readonly messages: string[];
}
