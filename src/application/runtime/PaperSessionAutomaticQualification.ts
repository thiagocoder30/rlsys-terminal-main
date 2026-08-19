import {
  PaperSessionSetupCoordinator,
  type PaperSessionQualificationResult,
  type PaperSessionSetupSnapshot,
  type PaperSessionSyncResult,
} from './PaperSessionSetupCoordinator.js';


export type PaperSessionAutomaticQualificationDecision =
  | 'APPROVED'
  | 'OBSERVE'
  | 'REJECTED'
  | 'SYNC_REJECTED';


export interface PaperSessionAutomaticQualificationInput {
  readonly rawHistory: string;
  readonly requiredWarmupSize: number;
  readonly synchronizedAtEpochMs?: number;
}


export interface PaperSessionAutomaticQualificationResult {
  readonly decision:
    PaperSessionAutomaticQualificationDecision;

  readonly sync:
    PaperSessionSyncResult;

  readonly qualification?:
    PaperSessionQualificationResult;

  readonly snapshot:
    PaperSessionSetupSnapshot;

  readonly sessionMayProceed: boolean;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Automates table qualification immediately after SYNC/RESYNC.
 *
 * User-facing intent:
 *
 *   paste history
 *       ↓
 *   automatic qualification
 *       ↓
 *   APPROVED / OBSERVE / REJECTED
 *
 * This component does not:
 * - configure the operator;
 * - execute preflight;
 * - PREPARE or START a session;
 * - authorize live money;
 * - execute entries.
 */
export class PaperSessionAutomaticQualification {
  public constructor(
    private readonly setup:
      PaperSessionSetupCoordinator,
  ) {}


  public syncAndQualify(
    input:
      PaperSessionAutomaticQualificationInput,
  ): PaperSessionAutomaticQualificationResult {
    this.validate(
      input,
    );

    const sync =
      this.setup.sync(
        input.rawHistory,
        input.synchronizedAtEpochMs,
      );

    if (
      !sync.parsed.accepted ||
      sync.history === undefined
    ) {
      return this.syncRejected(
        sync,
      );
    }

    return this.qualify(
      sync,
      input.requiredWarmupSize,
    );
  }


  public resyncAndQualify(
    input:
      PaperSessionAutomaticQualificationInput,
  ): PaperSessionAutomaticQualificationResult {
    this.validate(
      input,
    );

    const sync =
      this.setup.resync(
        input.rawHistory,
        input.synchronizedAtEpochMs,
      );

    if (
      !sync.parsed.accepted ||
      sync.history === undefined
    ) {
      return this.syncRejected(
        sync,
      );
    }

    return this.qualify(
      sync,
      input.requiredWarmupSize,
    );
  }


  private qualify(
    sync:
      PaperSessionSyncResult,

    requiredWarmupSize:
      number,
  ): PaperSessionAutomaticQualificationResult {
    const qualification =
      this.setup.qualify(
        requiredWarmupSize,
      );

    const snapshot =
      this.setup.snapshot();

    const decision =
      this.resolveDecision(
        snapshot,
      );

    return Object.freeze({
      decision,

      sync,

      qualification,

      snapshot,

      sessionMayProceed:
        decision === 'APPROVED',

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


  private syncRejected(
    sync:
      PaperSessionSyncResult,
  ): PaperSessionAutomaticQualificationResult {
    return Object.freeze({
      decision:
        'SYNC_REJECTED' as const,

      sync,

      snapshot:
        this.setup.snapshot(),

      sessionMayProceed:
        false,

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


  private resolveDecision(
    snapshot:
      PaperSessionSetupSnapshot,
  ): PaperSessionAutomaticQualificationDecision {
    if (
      snapshot.status ===
      'QUALIFIED'
    ) {
      return 'APPROVED';
    }

    if (
      snapshot.status ===
      'OBSERVE'
    ) {
      return 'OBSERVE';
    }

    return 'REJECTED';
  }


  private validate(
    input:
      PaperSessionAutomaticQualificationInput,
  ): void {
    if (
      typeof input.rawHistory !==
      'string'
    ) {
      throw new Error(
        'paper_session_auto_qualification_invalid_history',
      );
    }

    if (
      !Number.isInteger(
        input.requiredWarmupSize,
      ) ||
      input.requiredWarmupSize <= 0
    ) {
      throw new Error(
        'paper_session_auto_qualification_invalid_warmup_size',
      );
    }
  }
}
