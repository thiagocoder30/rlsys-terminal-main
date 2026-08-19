export interface PaperSessionBootstrapPort<TInput, TResult> {
  execute(input: TInput): TResult;
}

export interface PaperSessionPreflightPort<TInput, TResult> {
  evaluate(input: TInput, generatedAtEpochMs?: number): Promise<TResult>;
}

export interface PaperSessionSupervisorPort<TInput, TResult> {
  supervise(input: TInput): TResult;
}

export interface PaperSessionLaunchComposerInput<
  TBootstrapInput,
  TPreflightInput,
  TSupervisorInput,
> {
  readonly bootstrapInput: TBootstrapInput;
  readonly preflightInput: TPreflightInput;
  readonly supervisorInput: TSupervisorInput;
  readonly generatedAtEpochMs?: number;
}

export interface PaperSessionLaunchComposerReport<
  TBootstrapResult,
  TPreflightResult,
  TSupervisorResult,
> {
  readonly bootstrap: TBootstrapResult;
  readonly preflight: TPreflightResult;
  readonly supervisor: TSupervisorResult;
  readonly generatedAtEpochMs: number;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Application composer responsible only for PAPER session orchestration.
 *
 * It does not implement qualification rules, risk rules or execution rules.
 * It composes existing application services through ports.
 *
 * Complexity:
 * - Time: O(1) orchestration plus delegated service costs.
 * - Memory: O(1) besides returned immutable report.
 */
export class PaperSessionLaunchComposer<
  TBootstrapInput,
  TBootstrapResult,
  TPreflightInput,
  TPreflightResult,
  TSupervisorInput,
  TSupervisorResult,
> {
  public constructor(
    private readonly bootstrap: PaperSessionBootstrapPort<
      TBootstrapInput,
      TBootstrapResult
    >,
    private readonly preflight: PaperSessionPreflightPort<
      TPreflightInput,
      TPreflightResult
    >,
    private readonly supervisor: PaperSessionSupervisorPort<
      TSupervisorInput,
      TSupervisorResult
    >,
  ) {}

  public async compose(
    input: PaperSessionLaunchComposerInput<
      TBootstrapInput,
      TPreflightInput,
      TSupervisorInput
    >,
  ): Promise<
    PaperSessionLaunchComposerReport<
      TBootstrapResult,
      TPreflightResult,
      TSupervisorResult
    >
  > {
    const generatedAtEpochMs =
      input.generatedAtEpochMs ?? Date.now();

    const bootstrapResult = this.bootstrap.execute(
      input.bootstrapInput,
    );

    const preflightResult = await this.preflight.evaluate(
      input.preflightInput,
      generatedAtEpochMs,
    );

    const supervisorResult = this.supervisor.supervise(
      input.supervisorInput,
    );

    return Object.freeze({
      bootstrap: bootstrapResult,
      preflight: preflightResult,
      supervisor: supervisorResult,
      generatedAtEpochMs,
      paperOnly: true,
      liveMoneyAuthorization: false,
      automaticExecutionAllowed: false,
      humanSupervisionRequired: true,
    });
  }
}
