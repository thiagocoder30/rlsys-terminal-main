export type PaperSessionHistoryInputParserStatus =
  | 'PARSED'
  | 'EMPTY'
  | 'INVALID';

export interface PaperSessionHistoryInputParserResult {
  readonly status: PaperSessionHistoryInputParserStatus;
  readonly accepted: boolean;
  readonly rounds: readonly number[];
  readonly roundCount: number;
  readonly invalidTokens: readonly string[];
  readonly message: string;
}

/**
 * Parses roulette history manually pasted by the operator.
 *
 * Accepted separators include:
 * - spaces
 * - tabs
 * - commas
 * - semicolons
 * - line breaks
 * - pipes
 *
 * Examples:
 *   "32 15 0 19"
 *   "32,15,0,19"
 *   "32;15;0;19"
 *   "32\n15\n0\n19"
 *   "32 | 15, 0; 19"
 *
 * Only integer roulette values from 0 through 36 are accepted.
 *
 * This component does not:
 * - calculate entropy;
 * - calculate VIX;
 * - qualify the table;
 * - modify an active session.
 *
 * Complexity:
 * - Time: O(n), where n is pasted input length.
 * - Memory: O(r), where r is parsed round count.
 */
export class PaperSessionHistoryInputParser {
  public parse(
    input: string,
  ): PaperSessionHistoryInputParserResult {
    if (typeof input !== 'string') {
      return this.invalid(
        [],
        ['<non-string-input>'],
        'Histórico inválido.',
      );
    }

    const normalized = input.trim();

    if (normalized.length === 0) {
      return Object.freeze({
        status: 'EMPTY' as const,
        accepted: false,
        rounds: Object.freeze([]),
        roundCount: 0,
        invalidTokens: Object.freeze([]),
        message: 'Nenhum número foi informado no Sync.',
      });
    }

    const tokens = normalized
      .split(/[\s,;|]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const rounds: number[] = [];
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      if (!/^\d+$/.test(token)) {
        invalidTokens.push(token);
        continue;
      }

      const value = Number(token);

      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 36
      ) {
        invalidTokens.push(token);
        continue;
      }

      rounds.push(value);
    }

    if (invalidTokens.length > 0) {
      return this.invalid(
        rounds,
        invalidTokens,
        `Sync rejeitado: ${invalidTokens.length} valor(es) inválido(s) encontrado(s).`,
      );
    }

    if (rounds.length === 0) {
      return Object.freeze({
        status: 'EMPTY' as const,
        accepted: false,
        rounds: Object.freeze([]),
        roundCount: 0,
        invalidTokens: Object.freeze([]),
        message: 'Nenhuma rodada válida foi encontrada no Sync.',
      });
    }

    return Object.freeze({
      status: 'PARSED' as const,
      accepted: true,
      rounds: Object.freeze([...rounds]),
      roundCount: rounds.length,
      invalidTokens: Object.freeze([]),
      message: `${rounds.length} rodada(s) recebida(s) no Sync.`,
    });
  }

  private invalid(
    rounds: readonly number[],
    invalidTokens: readonly string[],
    message: string,
  ): PaperSessionHistoryInputParserResult {
    return Object.freeze({
      status: 'INVALID' as const,
      accepted: false,
      rounds: Object.freeze([...rounds]),
      roundCount: rounds.length,
      invalidTokens: Object.freeze([...invalidTokens]),
      message,
    });
  }
}
