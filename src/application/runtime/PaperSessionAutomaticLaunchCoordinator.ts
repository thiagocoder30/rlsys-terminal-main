import type {
  PaperSessionInstitutionalPreflight,
  PaperSessionInstitutionalPreflightExecution,
} from './PaperSessionInstitutionalPreflight.js';

import type {
  PaperRuntimeReadinessComposerReport,
} from './PaperRuntimeReadinessComposer.js';

import type {
  PaperSessionSetupSnapshot,
} from './PaperSessionSetupCoordinator.js';

import type {
  PaperRuntimeSessionSupervisor,
  PaperRuntimeSupervisorResult,
} from './PaperRuntimeSessionSupervisor.js';


export type PaperSessionAutomaticLaunchStatus =
  | 'AWAITING_CONFIRMATION'
  | 'PREFLIGHT_BLOCKED'
  | 'PREFLIGHT_REVIEW'
  | 'PREPARE_BLOCKED'
  | 'START_BLOCKED'
  | 'RUNNING';


export interface PaperSessionAutomaticLaunchInput {
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


export interface PaperSessionAutomaticLaunchResult {
  readonly status:
    PaperSessionAutomaticLaunchStatus;

  readonly sessionState:
    'IDLE' | 'READY' | 'RUNNING';

  readonly preflight?:
    PaperSessionInstitutionalPreflightExecution;

  readonly prepareSupervisor?:
    PaperRuntimeSupervisorResult;

  readonly startSupervisor?:
    PaperRuntimeSupervisorResult;

  readonly message:
    string;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Coordinates approved PAPER setup into a running supervised session.
 *
 * Product flow:
 *
 *   qualified table
 *        ↓
 *   runtime readiness
 *        ↓
 *   explicit human confirmation
 *        ↓
 *   institutional preflight
 *        ↓
 *   PREPARE
 *        ↓
 *   READY
 *        ↓
 *   START
 *        ↓
 *   RUNNING
 *
 * PREPARE and START both consume the real readiness values already produced
 * by PaperRuntimeReadinessComposer.
 *
 * No CERTIFIED / READY / SUPERVISED defaults are manufactured here.
 */
export class PaperSessionAutomaticLaunchCoordinator {
  public constructor(
    private readonly institutionalPreflight:
      PaperSessionInstitutionalPreflight,

    private readonly supervisor:
      PaperRuntimeSessionSupervisor,
  ) {}


  public async execute(
    input:
      PaperSessionAutomaticLaunchInput,
  ): Promise<
    PaperSessionAutomaticLaunchResult
  > {
    this.validate(
      input,
    );

    if (
      !input.operatorConfirmedLaunch
    ) {
      return this.result({
        status:
          'AWAITING_CONFIRMATION',

        sessionState:
          'IDLE',

        message:
          'Mesa e runtime aprovados. Confirmação humana necessária para iniciar a sessão PAPER.',
      });
    }

    const preflight =
      await this.institutionalPreflight.execute({
        setup:
          input.setup,

        runtimeReadiness:
          input.runtimeReadiness,

        operatorConfirmedLaunch:
          true,

        snapshotPathAvailable:
          input.snapshotPathAvailable,

        ledgerPathConfigured:
          input.ledgerPathConfigured,

        generatedAtEpochMs:
          input.generatedAtEpochMs,

        tableId:
          input.tableId,

        strategyName:
          input.strategyName,
      });

    if (
      !preflight.result.ok
    ) {
      return this.result({
        status:
          'PREFLIGHT_BLOCKED',

        sessionState:
          'IDLE',

        preflight,

        message:
          preflight.result.error.message,
      });
    }

    const verdict =
      preflight.result.value.verdict;

    if (
      verdict ===
      'PAPER_OPERATIONAL_REVIEW'
    ) {
      return this.result({
        status:
          'PREFLIGHT_REVIEW',

        sessionState:
          'IDLE',

        preflight,

        message:
          preflight.result.value.recommendation,
      });
    }

    if (
      verdict !==
      'PAPER_OPERATIONAL_GO'
    ) {
      return this.result({
        status:
          'PREFLIGHT_BLOCKED',

        sessionState:
          'IDLE',

        preflight,

        message:
          preflight.result.value.recommendation,
      });
    }

    const readiness =
      input.runtimeReadiness.readiness;

    const prepareSupervisor =
      this.supervisor.supervise({
        commandIntent:
          'PREPARE',

        enduranceStatus:
          readiness.enduranceStatus,

        riskReadiness:
          readiness.riskReadiness,

        operatorMode:
          readiness.operatorMode,

        sessionState:
          readiness.sessionState,
      });

    if (
      !prepareSupervisor.allowed ||
      prepareSupervisor.decision !==
        'SESSION_PREPARED' ||
      prepareSupervisor.nextSessionState !==
        'READY'
    ) {
      return this.result({
        status:
          'PREPARE_BLOCKED',

        sessionState:
          'IDLE',

        preflight,

        prepareSupervisor,

        message:
          prepareSupervisor.messages.join(
            ' ',
          ),
      });
    }

    const startSupervisor =
      this.supervisor.supervise({
        commandIntent:
          'START',

        enduranceStatus:
          readiness.enduranceStatus,

        riskReadiness:
          readiness.riskReadiness,

        operatorMode:
          readiness.operatorMode,

        sessionState:
          'READY',
      });

    if (
      !startSupervisor.allowed ||
      startSupervisor.decision !==
        'SESSION_STARTED' ||
      startSupervisor.nextSessionState !==
        'RUNNING'
    ) {
      return this.result({
        status:
          'START_BLOCKED',

        sessionState:
          'READY',

        preflight,

        prepareSupervisor,

        startSupervisor,

        message:
          startSupervisor.messages.join(
            ' ',
          ),
      });
    }

    return this.result({
      status:
        'RUNNING',

      sessionState:
        'RUNNING',

      preflight,

      prepareSupervisor,

      startSupervisor,

      message:
        'Sessão PAPER iniciada. Modo de acompanhamento por giro liberado.',
    });
  }


  private validate(
    input:
      PaperSessionAutomaticLaunchInput,
  ): void {
    if (
      input.setup.configuration ===
        null ||
      input.setup.configuration.status !==
        'CONFIGURED'
    ) {
      throw new Error(
        'paper_session_auto_launch_configuration_not_ready',
      );
    }

    if (
      input.setup.qualification ===
        null ||
      !input.setup.qualification.qualified
    ) {
      throw new Error(
        'paper_session_auto_launch_table_not_qualified',
      );
    }

    if (
      !input.runtimeReadiness
        .readyForPrepare
    ) {
      throw new Error(
        'paper_session_auto_launch_runtime_not_ready',
      );
    }

    if (
      typeof
        input.operatorConfirmedLaunch !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_auto_launch_invalid_confirmation',
      );
    }

    if (
      typeof
        input.snapshotPathAvailable !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_auto_launch_invalid_snapshot_state',
      );
    }

    if (
      typeof
        input.ledgerPathConfigured !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_auto_launch_invalid_ledger_state',
      );
    }
  }


  private result(
    input: {
      readonly status:
        PaperSessionAutomaticLaunchStatus;

      readonly sessionState:
        'IDLE' | 'READY' | 'RUNNING';

      readonly preflight?:
        PaperSessionInstitutionalPreflightExecution;

      readonly prepareSupervisor?:
        PaperRuntimeSupervisorResult;

      readonly startSupervisor?:
        PaperRuntimeSupervisorResult;

      readonly message:
        string;
    },
  ): PaperSessionAutomaticLaunchResult {
    return Object.freeze({
      ...input,

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
}
