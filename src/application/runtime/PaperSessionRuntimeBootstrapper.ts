import {
  PaperSessionLaunchComposer,
} from './PaperSessionLaunchComposer.js';

import type {
  PaperSessionBootstrapInput,
  PaperSessionBootstrapReport,
} from './PaperSessionBootstrap.js';

import type {
  FirstPaperSessionFinalPreflightInput,
  FirstPaperSessionFinalPreflightReport,
  FirstPaperSessionFinalPreflightResult,
  FirstPaperSessionFinalPreflightOrchestrator,
} from './FirstPaperSessionFinalPreflightOrchestrator.js';

import type {
  PaperRuntimeSupervisorInput,
  PaperRuntimeSupervisorResult,
  PaperRuntimeSessionSupervisor,
} from './PaperRuntimeSessionSupervisor.js';


export interface PaperSessionRuntimeBootstrapInput {
  readonly bootstrapInput: PaperSessionBootstrapInput;

  readonly preflightInput: FirstPaperSessionFinalPreflightInput;

  readonly supervisorInput: PaperRuntimeSupervisorInput;

  readonly generatedAtEpochMs?: number;
}


export interface PaperSessionRuntimeBootstrapReport {
  readonly bootstrap: PaperSessionBootstrapReport;

  readonly preflight:
    FirstPaperSessionFinalPreflightResult<FirstPaperSessionFinalPreflightReport>;

  readonly supervisor: PaperRuntimeSupervisorResult;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Application wiring for supervised PAPER runtime launch.
 *
 * This component does not create infrastructure dependencies.
 * Dependencies are injected by the composition root.
 *
 * Responsibilities:
 * - connect bootstrap;
 * - connect final preflight;
 * - connect runtime supervisor.
 *
 * It does not:
 * - execute bets;
 * - authorize live money;
 * - calculate strategies.
 */
export class PaperSessionRuntimeBootstrapper {
  private readonly composer:
    PaperSessionLaunchComposer<
      PaperSessionBootstrapInput,
      PaperSessionBootstrapReport,
      FirstPaperSessionFinalPreflightInput,
      FirstPaperSessionFinalPreflightResult<FirstPaperSessionFinalPreflightReport>,
      PaperRuntimeSupervisorInput,
      PaperRuntimeSupervisorResult
    >;

  public constructor(
    bootstrap: {
      execute(
        input: PaperSessionBootstrapInput,
      ): PaperSessionBootstrapReport;
    },
    preflight: Pick<
      FirstPaperSessionFinalPreflightOrchestrator,
      'evaluate'
    >,
    supervisor: Pick<
      PaperRuntimeSessionSupervisor,
      'supervise'
    >,
  ) {
    this.composer =
      new PaperSessionLaunchComposer(
        bootstrap,
        preflight,
        supervisor,
      );
  }

  public async launch(
    input: PaperSessionRuntimeBootstrapInput,
  ): Promise<PaperSessionRuntimeBootstrapReport> {
    const result = await this.composer.compose({
      bootstrapInput: input.bootstrapInput,
      preflightInput: input.preflightInput,
      supervisorInput: input.supervisorInput,
      generatedAtEpochMs: input.generatedAtEpochMs,
    });

    return {
      bootstrap: result.bootstrap,
      preflight: result.preflight,
      supervisor: result.supervisor,
      paperOnly: true,
      liveMoneyAuthorization: false,
      automaticExecutionAllowed: false,
      humanSupervisionRequired: true,
    };
  }
}
