export type PostSyncOperationalMode =
  | 'AWAITING_CONFIRMATION'
  | 'CATCH_UP'
  | 'LIVE';


export interface PostSyncCatchUpSnapshot {
  readonly mode:
    PostSyncOperationalMode;

  readonly catchUpSpins:
    number;

  readonly prospectiveSignalsAllowed:
    boolean;

  readonly bankrollImpactAllowed:
    boolean;

  readonly operatorDecisionPromptAllowed:
    boolean;
}


/**
 * Establishes the temporal audit boundary after table Sync.
 *
 * Important:
 *
 * CATCH_UP spins:
 *
 * - update analytical state;
 * - may update entropy/VIX/heatmap/strategies;
 * - are NOT prospective evidence;
 * - must NOT create recommendation records;
 * - must NOT affect bankroll;
 * - must NOT ask FOLLOWED/IGNORED.
 *
 * Only spins entered after transition to LIVE may produce prospective
 * operator-facing recommendations.
 */
export class PostSyncCatchUpBoundary {
  private mode:
    PostSyncOperationalMode =
      'AWAITING_CONFIRMATION';

  private catchUpSpins =
    0;


  public confirmHistoryCurrent(
    raw:
      string,
  ): PostSyncCatchUpSnapshot {
    if (
      this.mode !==
      'AWAITING_CONFIRMATION'
    ) {
      throw new Error(
        'post_sync_confirmation_already_resolved',
      );
    }

    const value =
      raw.trim()
        .toLowerCase();

    if (
      value ===
      's'
    ) {
      this.mode =
        'LIVE';

      return this.snapshot();
    }

    if (
      value ===
      'n'
    ) {
      this.mode =
        'CATCH_UP';

      return this.snapshot();
    }

    throw new Error(
      'post_sync_confirmation_expected_s_or_n',
    );
  }


  public recordCatchUpSpin(
    spin:
      number,
  ): PostSyncCatchUpSnapshot {
    if (
      this.mode !==
      'CATCH_UP'
    ) {
      throw new Error(
        'post_sync_not_in_catch_up',
      );
    }

    this.validateSpin(
      spin,
    );

    this.catchUpSpins +=
      1;

    return this.snapshot();
  }


  public finishCatchUp():
    PostSyncCatchUpSnapshot {
    if (
      this.mode !==
      'CATCH_UP'
    ) {
      throw new Error(
        'post_sync_not_in_catch_up',
      );
    }

    this.mode =
      'LIVE';

    return this.snapshot();
  }


  public assertProspectiveAllowed():
    void {
    if (
      this.mode !==
      'LIVE'
    ) {
      throw new Error(
        'post_sync_prospective_signal_not_allowed',
      );
    }
  }


  public snapshot():
    PostSyncCatchUpSnapshot {
    const live =
      this.mode ===
      'LIVE';

    return Object.freeze({
      mode:
        this.mode,

      catchUpSpins:
        this.catchUpSpins,

      prospectiveSignalsAllowed:
        live,

      bankrollImpactAllowed:
        live,

      operatorDecisionPromptAllowed:
        live,
    });
  }


  private validateSpin(
    spin:
      number,
  ): void {
    if (
      !Number.isInteger(
        spin,
      ) ||
      spin < 0 ||
      spin > 36
    ) {
      throw new Error(
        'post_sync_invalid_spin',
      );
    }
  }
}
