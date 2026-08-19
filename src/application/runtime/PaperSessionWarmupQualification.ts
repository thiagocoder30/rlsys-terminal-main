import {
  WarmupQualificationRuntimePipeline,
  type WarmupQualificationReport,
} from '../warmup/WarmupQualificationRuntimePipeline.js';

import type {
  PaperSessionHistorySyncSnapshot,
} from './PaperSessionHistorySyncState.js';

export interface PaperSessionWarmupQualificationInput {
  readonly history: PaperSessionHistorySyncSnapshot;
  readonly requiredWarmupSize?: number;
}

export interface PaperSessionWarmupQualificationReport {
  readonly qualified: boolean;
  readonly observationAllowed: boolean;
  readonly synchronizedRounds: number;
  readonly syncVersion: number;
  readonly qualification: WarmupQualificationReport;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Bridges the operator-controlled history Sync with the institutional
 * WarmupQualificationRuntimePipeline.
 *
 * This component does not calculate entropy, VIX or qualification rules.
 * It delegates all statistical qualification to the existing warmup pipeline.
 *
 * Complexity:
 * - Time: O(n), delegated to the warmup pipeline.
 * - Memory: O(n), where n is the synchronized history size.
 */
export class PaperSessionWarmupQualification {
  public constructor(
    private readonly pipeline:
      Pick<WarmupQualificationRuntimePipeline, 'qualify'> =
        new WarmupQualificationRuntimePipeline(),
  ) {}

  public qualify(
    input: PaperSessionWarmupQualificationInput,
  ): PaperSessionWarmupQualificationReport {
    this.validateHistory(input.history);

    const qualification = this.pipeline.qualify({
      source: 'manual',
      values: input.history.rounds,
      requiredWarmupSize: input.requiredWarmupSize,
    });

    return Object.freeze({
      qualified:
        qualification.status === 'QUALIFIED' &&
        qualification.decision.supervisedOperationAllowed,
      observationAllowed:
        qualification.decision.supervisedObservationAllowed,
      synchronizedRounds: input.history.roundCount,
      syncVersion: input.history.syncVersion,
      qualification,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }

  private validateHistory(
    history: PaperSessionHistorySyncSnapshot,
  ): void {
    if (
      history.status === 'UNSYNCED' ||
      history.roundCount === 0 ||
      history.rounds.length === 0
    ) {
      throw new Error(
        'paper_session_warmup_history_not_synchronized',
      );
    }

    if (history.roundCount !== history.rounds.length) {
      throw new Error(
        'paper_session_warmup_history_count_mismatch',
      );
    }
  }
}
