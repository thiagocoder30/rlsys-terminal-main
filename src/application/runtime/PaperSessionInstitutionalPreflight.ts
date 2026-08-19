import type {
  FirstPaperSessionFinalPreflightInput,
  FirstPaperSessionFinalPreflightReport,
  FirstPaperSessionFinalPreflightResult,
} from './FirstPaperSessionFinalPreflightOrchestrator.js';

import type {
  PaperRuntimeReadinessComposerReport,
} from './PaperRuntimeReadinessComposer.js';

import type {
  PaperSessionSetupSnapshot,
} from './PaperSessionSetupCoordinator.js';


export interface PaperSessionFinalPreflightPort {
  evaluate(
    input: FirstPaperSessionFinalPreflightInput,
    generatedAtEpochMs?: number,
  ): Promise<
    FirstPaperSessionFinalPreflightResult<
      FirstPaperSessionFinalPreflightReport
    >
  >;
}


export interface PaperSessionInstitutionalPreflightInput {
  readonly setup:
    PaperSessionSetupSnapshot;

  readonly runtimeReadiness:
    PaperRuntimeReadinessComposerReport;

  readonly operatorConfirmedLaunch:
    boolean;

  readonly snapshotPathAvailable:
    boolean;

  readonly ledgerPathConfigured:
    boolean;

  readonly generatedAtEpochMs?:
    number;

  readonly tableId?:
    string;

  readonly strategyName?:
    string;
}


export interface PaperSessionInstitutionalPreflightExecution {
  readonly request:
    FirstPaperSessionFinalPreflightInput;

  readonly result:
    FirstPaperSessionFinalPreflightResult<
      FirstPaperSessionFinalPreflightReport
    >;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Bridges validated PAPER setup/runtime readiness into the existing
 * FirstPaperSessionFinalPreflightOrchestrator.
 *
 * This component does not:
 * - manufacture runtime readiness;
 * - infer operator confirmation;
 * - probe filesystem paths;
 * - execute PREPARE or START;
 * - authorize live money.
 *
 * All infrastructure facts and the human launch confirmation must be supplied
 * explicitly by the caller.
 *
 * Complexity:
 * - Time: delegated to final preflight orchestrator.
 * - Memory: O(1) orchestration overhead.
 */
export class PaperSessionInstitutionalPreflight {
  public constructor(
    private readonly preflight:
      PaperSessionFinalPreflightPort,
  ) {}


  public async execute(
    input:
      PaperSessionInstitutionalPreflightInput,
  ): Promise<
    PaperSessionInstitutionalPreflightExecution
  > {
    this.validate(
      input,
    );

    const configuration =
      input.setup.configuration!;

    const qualification =
      input.setup.qualification!;

    const request:
      FirstPaperSessionFinalPreflightInput = {
        sessionId:
          configuration.sessionId,

        operatorConfirmedLaunch:
          input.operatorConfirmedLaunch,

        runtimePaperAvailable:
          input.runtimeReadiness
            .readiness
            .runtimePaperAvailable,

        snapshotPathAvailable:
          input.snapshotPathAvailable,

        ledgerPathConfigured:
          input.ledgerPathConfigured,

        operatorId:
          configuration.operatorId,

        tableId:
          input.tableId,

        strategyName:
          input.strategyName,

        bankrollLabel:
          `R$ ${configuration.bankroll
            .toFixed(2)
            .replace('.', ',')}`,

        plannedRounds:
          input.setup.history.roundCount,

        notes: Object.freeze([
          `provider=${configuration.provider}`,
          `riskMode=${configuration.riskMode}`,
          `allowMartingale=${configuration.allowMartingale}`,
          `syncVersion=${input.setup.history.syncVersion}`,
          `warmupStatus=${qualification.qualification.status}`,
          `warmupReason=${qualification.qualification.reason}`,
          `runtimeCertification=${input.runtimeReadiness.runtimeCertification.status}`,
          `endurance=${input.runtimeReadiness.endurance.status}`,
          `riskVerdict=${input.runtimeReadiness.risk.decision.verdict}`,
          `riskReadiness=${input.runtimeReadiness.readiness.riskReadiness}`,
        ]),

        allowNeedsReviewRecording:
          false,
      };

    const result =
      await this.preflight.evaluate(
        request,
        input.generatedAtEpochMs,
      );

    return Object.freeze({
      request,

      result,

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticExecutionAllowed:
        false as const,

      humanSupervisionRequired:
        true as const,
    });
  }


  private validate(
    input:
      PaperSessionInstitutionalPreflightInput,
  ): void {
    if (
      input.setup.configuration === null ||
      input.setup.configuration.status !==
        'CONFIGURED'
    ) {
      throw new Error(
        'paper_session_preflight_configuration_not_ready',
      );
    }

    if (
      input.setup.qualification === null ||
      !input.setup.qualification.qualified
    ) {
      throw new Error(
        'paper_session_preflight_warmup_not_qualified',
      );
    }

    if (
      !input.runtimeReadiness.readyForPrepare
    ) {
      throw new Error(
        'paper_session_preflight_runtime_not_ready',
      );
    }

    if (
      typeof input.operatorConfirmedLaunch !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_preflight_invalid_operator_confirmation',
      );
    }

    if (
      typeof input.snapshotPathAvailable !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_preflight_invalid_snapshot_availability',
      );
    }

    if (
      typeof input.ledgerPathConfigured !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_preflight_invalid_ledger_configuration',
      );
    }
  }
}
