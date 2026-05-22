export interface AssistedRuntimeStepResult {
  readonly shouldContinue: boolean;
  readonly message: string;
}

export interface AssistedRuntimeStepPort {
  step(input: string, occurredAtEpochMs?: number): Promise<AssistedRuntimeStepResult>;
}

export interface RuntimeLineReaderPort {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface RuntimeLineWriterPort {
  writeLine(message: string): void;
}

export interface NodeReadlineAssistedRuntimeAdapterOptions {
  readonly prompt: string;
  readonly welcomeMessage?: string;
  readonly shutdownMessage?: string;
  readonly maxSteps?: number;
}

/**
 * Infrastructure adapter that connects a line-based terminal interface to the
 * assisted runtime REPL step executor.
 *
 * It stays outside the domain/application rules and depends only on ports.
 *
 * Complexity:
 * - O(s * n), where s is processed lines and n is line length.
 * - Memory O(1), no unbounded buffering.
 */
export class NodeReadlineAssistedRuntimeAdapter {
  private readonly prompt: string;
  private readonly welcomeMessage: string;
  private readonly shutdownMessage: string;
  private readonly maxSteps: number;

  public constructor(
    private readonly reader: RuntimeLineReaderPort,
    private readonly writer: RuntimeLineWriterPort,
    private readonly runtime: AssistedRuntimeStepPort,
    options: NodeReadlineAssistedRuntimeAdapterOptions,
  ) {
    this.prompt = options.prompt;
    this.welcomeMessage = options.welcomeMessage ?? "RL.SYS assisted runtime started.";
    this.shutdownMessage = options.shutdownMessage ?? "RL.SYS assisted runtime stopped.";
    this.maxSteps = options.maxSteps ?? 10_000;
  }

  public async run(): Promise<void> {
    this.writer.writeLine(this.welcomeMessage);

    let shouldContinue = true;
    let steps = 0;

    try {
      while (shouldContinue && steps < this.maxSteps) {
        steps += 1;

        const input = await this.reader.question(this.prompt);
        const result = await this.runtime.step(input, Date.now());

        shouldContinue = result.shouldContinue;
      }

      if (steps >= this.maxSteps) {
        this.writer.writeLine("Runtime stopped because maxSteps safety limit was reached.");
      }
    } finally {
      this.reader.close();
      this.writer.writeLine(this.shutdownMessage);
    }
  }
}
