import { EngineExecutionMetadata } from './EngineExecutionMetadata';

export interface QuantitativeOutput {
  readonly engineName: string;
  readonly score: number;
  readonly confidence: number;
  readonly executionTime: number;
  readonly metadata: EngineExecutionMetadata;
  readonly diagnostics: Record<string, unknown>;
}
