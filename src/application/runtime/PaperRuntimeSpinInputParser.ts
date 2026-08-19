export type PaperRuntimeSpinInputResult =
  | {
      readonly kind:
        'EMPTY';
    }
  | {
      readonly kind:
        'SPIN';

      readonly spin:
        number;
    }
  | {
      readonly kind:
        'COMMAND';

      readonly command:
        'READY';
    }
  | {
      readonly kind:
        'INVALID';

      readonly raw:
        string;
    };


/**
 * Canonical parser for operator-entered roulette spins.
 *
 * Critical invariant:
 *
 *   EMPTY INPUT IS NOT ZERO.
 *
 * JavaScript's Number('') === 0 must never leak into
 * the operational roulette timeline.
 *
 * This parser:
 *
 * - preserves explicit zero as a valid roulette spin;
 * - rejects values outside 0..36;
 * - treats blank/whitespace-only input as EMPTY;
 * - recognizes the CATCH-UP completion command;
 * - does not mutate history;
 * - does not execute any recommendation or bet.
 */
export class PaperRuntimeSpinInputParser {
  public parse(
    raw:
      string,
    options: {
      readonly allowReadyCommand?:
        boolean;
    } = {},
  ): PaperRuntimeSpinInputResult {
    if (
      typeof raw !==
      'string'
    ) {
      return Object.freeze({
        kind:
          'INVALID' as const,

        raw:
          String(
            raw,
          ),
      });
    }

    const normalized =
      raw.trim();

    if (
      normalized.length ===
      0
    ) {
      return Object.freeze({
        kind:
          'EMPTY' as const,
      });
    }

    if (
      options.allowReadyCommand ===
        true &&
      normalized.toLowerCase() ===
        'pronto'
    ) {
      return Object.freeze({
        kind:
          'COMMAND' as const,

        command:
          'READY' as const,
      });
    }

    /*
     * Do not use Number(normalized) before proving
     * that the complete input is an integer token.
     *
     * Examples rejected here:
     *
     *   1.5
     *   2abc
     *   +3
     *   03foo
     */
    if (
      !/^\d+$/.test(
        normalized,
      )
    ) {
      return Object.freeze({
        kind:
          'INVALID' as const,

        raw,
      });
    }

    const spin =
      Number(
        normalized,
      );

    if (
      !Number.isInteger(
        spin,
      ) ||
      spin <
        0 ||
      spin >
        36
    ) {
      return Object.freeze({
        kind:
          'INVALID' as const,

        raw,
      });
    }

    return Object.freeze({
      kind:
        'SPIN' as const,

      spin,
    });
  }
}
