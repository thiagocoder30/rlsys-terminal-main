export type PaperOperatorDecision =
  | 'FOLLOWED'
  | 'IGNORED';


export interface PaperOperatorDecisionResult {
  readonly decision:
    PaperOperatorDecision;

  readonly normalizedInput:
    's' | 'n';

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Minimal operator-decision parser for live roulette timing.
 *
 * Accepted:
 *
 * s / S = FOLLOWED
 * n / N = IGNORED
 *
 * FOLLOWED means only that the operator reports having followed
 * the recommendation manually.
 *
 * This class does not and cannot execute anything.
 */
export class PaperOperatorDecisionSemantics {
  public parse(
    raw:
      string,
  ): PaperOperatorDecisionResult {
    const value =
      raw.trim()
        .toLowerCase();

    if (
      value !==
        's' &&
      value !==
        'n'
    ) {
      throw new Error(
        'paper_operator_decision_expected_s_or_n',
      );
    }

    return Object.freeze({
      decision:
        value ===
        's'
          ? 'FOLLOWED'
          : 'IGNORED',

      normalizedInput:
        value,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }
}
