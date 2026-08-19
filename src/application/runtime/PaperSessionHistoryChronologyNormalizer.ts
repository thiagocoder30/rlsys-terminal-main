export type PaperSessionExternalHistoryOrder =
  'NEWEST_TO_OLDEST';

export type PaperSessionCanonicalHistoryOrder =
  'OLDEST_TO_NEWEST';


export interface PaperSessionHistoryChronologyReport {
  readonly sourceOrder:
    PaperSessionExternalHistoryOrder;

  readonly canonicalOrder:
    PaperSessionCanonicalHistoryOrder;

  readonly receivedRounds:
    number;

  readonly rounds:
    readonly number[];

  readonly oldestRound:
    number | null;

  readonly newestRound:
    number | null;
}


/**
 * Canonical chronology boundary for manually pasted roulette history.
 *
 * External contract used by the current operator workflow:
 *
 *   NEWEST -> OLDEST
 *
 * Canonical internal RL.Sys contract:
 *
 *   OLDEST -> NEWEST
 *
 * This allows every downstream component to use:
 *
 *   history[history.length - 1]
 *   history.slice(-N)
 *   history.push(newRound)
 *
 * with the conventional meaning of "most recent".
 *
 * This component:
 * - does not calculate statistics;
 * - does not qualify tables;
 * - does not alter roulette values;
 * - does not remove rounds;
 * - does not authorize execution.
 */
export class PaperSessionHistoryChronologyNormalizer {
  public normalizeNewestFirst(
    rounds:
      readonly number[],
  ): PaperSessionHistoryChronologyReport {
    this.validate(
      rounds,
    );

    const canonical =
      Object.freeze([
        ...rounds,
      ].reverse());

    return Object.freeze({
      sourceOrder:
        'NEWEST_TO_OLDEST' as const,

      canonicalOrder:
        'OLDEST_TO_NEWEST' as const,

      receivedRounds:
        canonical.length,

      rounds:
        canonical,

      oldestRound:
        canonical.length ===
          0
          ? null
          : canonical[0],

      newestRound:
        canonical.length ===
          0
          ? null
          : canonical[
              canonical.length -
              1
            ],
    });
  }


  private validate(
    rounds:
      readonly number[],
  ): void {
    if (
      !Array.isArray(
        rounds,
      )
    ) {
      throw new Error(
        'paper_history_chronology_rounds_must_be_array',
      );
    }

    for (
      let index = 0;
      index < rounds.length;
      index += 1
    ) {
      const value =
        rounds[index];

      if (
        !Number.isInteger(
          value,
        ) ||
        value <
          0 ||
        value >
          36
      ) {
        throw new Error(
          `paper_history_chronology_invalid_round:${index}:${value}`,
        );
      }
    }
  }
}
