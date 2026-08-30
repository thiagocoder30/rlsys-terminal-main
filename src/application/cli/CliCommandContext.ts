export interface CliCommandContext {
  readonly kernel: unknown;
  readonly startedAtEpochMs: number;
}

export interface CliCommandResult {
  readonly success: boolean;
  readonly output: string;
}
