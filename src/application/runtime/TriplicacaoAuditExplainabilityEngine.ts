export type TriplicacaoAuditColor = 'RED' | 'BLACK';
export type TriplicacaoAuditPatternKind = 'TC' | 'NTC' | 'TA' | 'NTA';
export type TriplicacaoAuditReadDirection = 'BOTTOM_TO_TOP_RIGHT_TO_LEFT';

export interface TriplicacaoAuditGridCell {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly roundNumber: number;
}

export interface TriplicacaoAuditRound {
  readonly sequenceIndex: number;
  readonly roundNumber: number;
  readonly color: TriplicacaoAuditColor | 'ZERO';
  readonly sourceRowIndex?: number;
  readonly sourceColumnIndex?: number;
}

export interface TriplicacaoAuditTrio {
  readonly trioId: string;
  readonly trioIndex: number;
  readonly sourceSequenceIndexes: readonly [number, number, number];
  readonly numbers: readonly [number, number, number];
  readonly colors: readonly [TriplicacaoAuditColor, TriplicacaoAuditColor, TriplicacaoAuditColor];
  readonly patternKind: TriplicacaoAuditPatternKind;
  readonly containsZero: false;
}

export interface TriplicacaoZeroDiscardAudit {
  readonly discardId: string;
  readonly sourceSequenceIndexes: readonly [number, number, number];
  readonly numbers: readonly [number, number, number];
  readonly reason: 'ZERO_IN_TRIO';
}

export interface TriplicacaoPatternAuditSummary {
  readonly patternKind: TriplicacaoAuditPatternKind;
  readonly count: number;
  readonly frequencyPercent: number;
  readonly lastSeenDistance: number | null;
  readonly maxConsecutive: number;
}

export interface TriplicacaoAuditReport {
  readonly readDirection: TriplicacaoAuditReadDirection;
  readonly totalRounds: number;
  readonly validTrioCount: number;
  readonly discardedZeroTrioCount: number;
  readonly rounds: readonly TriplicacaoAuditRound[];
  readonly trios: readonly TriplicacaoAuditTrio[];
  readonly zeroDiscards: readonly TriplicacaoZeroDiscardAudit[];
  readonly summaries: readonly TriplicacaoPatternAuditSummary[];
  readonly latestTrios: readonly TriplicacaoAuditTrio[];
  readonly auditText: string;
  readonly latestText: string;
  readonly debugText: string;
  readonly explainText: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS: ReadonlySet<number> = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

const PATTERNS: readonly TriplicacaoAuditPatternKind[] = ['TC', 'NTC', 'TA', 'NTA'];

export class TriplicacaoAuditExplainabilityEngine {
  public auditFromGrid(
    grid: readonly (readonly number[])[],
    options: { readonly latestLimit?: number } = {},
  ): TriplicacaoAuditReport {
    const rounds = this.readGridBottomToTopRightToLeft(grid);
    return this.auditFromSequence(rounds.map((round) => round.roundNumber), {
      latestLimit: options.latestLimit,
      sourceRounds: rounds,
    });
  }

  public auditFromSequence(
    sequence: readonly number[],
    options: {
      readonly latestLimit?: number;
      readonly sourceRounds?: readonly TriplicacaoAuditRound[];
    } = {},
  ): TriplicacaoAuditReport {
    const latestLimit = this.positiveIntegerOrDefault(options.latestLimit, 8);
    const rounds = options.sourceRounds ?? this.sequenceToRounds(sequence);
    const build = this.buildTrios(rounds);
    const summaries = this.summarize(build.trios);
    const latestTrios = Object.freeze(build.trios.slice(Math.max(0, build.trios.length - latestLimit)));

    const reportBase = {
      readDirection: 'BOTTOM_TO_TOP_RIGHT_TO_LEFT' as const,
      totalRounds: rounds.length,
      validTrioCount: build.trios.length,
      discardedZeroTrioCount: build.zeroDiscards.length,
      rounds: Object.freeze([...rounds]),
      trios: Object.freeze([...build.trios]),
      zeroDiscards: Object.freeze([...build.zeroDiscards]),
      summaries,
      latestTrios,
      paperOnly: true as const,
      liveMoneyAuthorized: false as const,
      productionMoneyAllowed: false as const,
    };

    return Object.freeze({
      ...reportBase,
      auditText: this.composeAuditText(reportBase),
      latestText: this.composeLatestText(reportBase),
      debugText: this.composeDebugText(reportBase),
      explainText: this.composeExplainText(reportBase),
    });
  }

  public formatCommand(
    report: TriplicacaoAuditReport,
    command: 'triplicacao audit' | 'triplicacao latest' | 'triplicacao debug' | 'triplicacao explain',
  ): string {
    if (command === 'triplicacao latest') {
      return report.latestText;
    }

    if (command === 'triplicacao debug') {
      return report.debugText;
    }

    if (command === 'triplicacao explain') {
      return report.explainText;
    }

    return report.auditText;
  }

  private readGridBottomToTopRightToLeft(
    grid: readonly (readonly number[])[],
  ): readonly TriplicacaoAuditRound[] {
    const rounds: TriplicacaoAuditRound[] = [];
    let sequenceIndex = 0;

    for (let rowIndex = grid.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const row = grid[rowIndex];

      for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex -= 1) {
        const roundNumber = row[columnIndex];

        if (!Number.isInteger(roundNumber) || roundNumber < 0 || roundNumber > 36) {
          continue;
        }

        rounds.push(Object.freeze({
          sequenceIndex,
          roundNumber,
          color: this.toColor(roundNumber),
          sourceRowIndex: rowIndex,
          sourceColumnIndex: columnIndex,
        }));

        sequenceIndex += 1;
      }
    }

    return Object.freeze(rounds);
  }

  private sequenceToRounds(sequence: readonly number[]): readonly TriplicacaoAuditRound[] {
    const rounds: TriplicacaoAuditRound[] = [];

    for (let index = 0; index < sequence.length; index += 1) {
      const roundNumber = sequence[index];

      if (!Number.isInteger(roundNumber) || roundNumber < 0 || roundNumber > 36) {
        continue;
      }

      rounds.push(Object.freeze({
        sequenceIndex: rounds.length,
        roundNumber,
        color: this.toColor(roundNumber),
      }));
    }

    return Object.freeze(rounds);
  }

  private buildTrios(rounds: readonly TriplicacaoAuditRound[]): {
    readonly trios: readonly TriplicacaoAuditTrio[];
    readonly zeroDiscards: readonly TriplicacaoZeroDiscardAudit[];
  } {
    const trios: TriplicacaoAuditTrio[] = [];
    const zeroDiscards: TriplicacaoZeroDiscardAudit[] = [];

    for (let index = 0; index + 2 < rounds.length; index += 3) {
      const first = rounds[index];
      const second = rounds[index + 1];
      const third = rounds[index + 2];

      const numbers = [first.roundNumber, second.roundNumber, third.roundNumber] as const;
      const sourceSequenceIndexes = [first.sequenceIndex, second.sequenceIndex, third.sequenceIndex] as const;

      if (numbers[0] === 0 || numbers[1] === 0 || numbers[2] === 0) {
        zeroDiscards.push(Object.freeze({
          discardId: `discard-${zeroDiscards.length + 1}`,
          sourceSequenceIndexes,
          numbers,
          reason: 'ZERO_IN_TRIO',
        }));
        continue;
      }

      const firstColor = this.toColor(numbers[0]);
      const secondColor = this.toColor(numbers[1]);
      const thirdColor = this.toColor(numbers[2]);

      if (firstColor === 'ZERO' || secondColor === 'ZERO' || thirdColor === 'ZERO') {
        continue;
      }

      trios.push(Object.freeze({
        trioId: `trio-${trios.length + 1}`,
        trioIndex: trios.length,
        sourceSequenceIndexes,
        numbers,
        colors: [firstColor, secondColor, thirdColor] as const,
        patternKind: this.classify(firstColor, secondColor, thirdColor),
        containsZero: false,
      }));
    }

    return Object.freeze({
      trios: Object.freeze(trios),
      zeroDiscards: Object.freeze(zeroDiscards),
    });
  }

  private summarize(trios: readonly TriplicacaoAuditTrio[]): readonly TriplicacaoPatternAuditSummary[] {
    return Object.freeze(PATTERNS.map((patternKind) => {
      const matching = trios.filter((trio) => trio.patternKind === patternKind);
      return Object.freeze({
        patternKind,
        count: matching.length,
        frequencyPercent: this.percent(matching.length, trios.length),
        lastSeenDistance: this.lastSeenDistance(trios, patternKind),
        maxConsecutive: this.maxConsecutive(trios, patternKind),
      });
    }));
  }

  private classify(
    first: TriplicacaoAuditColor,
    second: TriplicacaoAuditColor,
    third: TriplicacaoAuditColor,
  ): TriplicacaoAuditPatternKind {
    if (first === second && second === third) {
      return 'TC';
    }

    if (first === second && second !== third) {
      return 'NTC';
    }

    if (first !== second && first === third) {
      return 'TA';
    }

    return 'NTA';
  }

  private composeAuditText(report: {
    readonly readDirection: TriplicacaoAuditReadDirection;
    readonly totalRounds: number;
    readonly validTrioCount: number;
    readonly discardedZeroTrioCount: number;
    readonly summaries: readonly TriplicacaoPatternAuditSummary[];
  }): string {
    return [
      'TRIPLICACAO AUDIT',
      `READ_DIRECTION=${report.readDirection}`,
      `TOTAL_ROUNDS=${report.totalRounds}`,
      `VALID_TRIOS=${report.validTrioCount}`,
      `ZERO_DISCARDS=${report.discardedZeroTrioCount}`,
      ...report.summaries.map((summary) => `${summary.patternKind}: count=${summary.count} freq=${summary.frequencyPercent}% lastSeen=${summary.lastSeenDistance ?? 'none'} maxSeq=${summary.maxConsecutive}`),
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join('\n');
  }

  private composeLatestText(report: {
    readonly latestTrios: readonly TriplicacaoAuditTrio[];
  }): string {
    return [
      'TRIPLICACAO LATEST',
      ...report.latestTrios.map((trio) => `#${trio.trioIndex + 1} [${trio.colors.join(',')}] ${trio.patternKind} numbers=[${trio.numbers.join(',')}] seq=[${trio.sourceSequenceIndexes.join(',')}]`),
    ].join('\n');
  }

  private composeDebugText(report: {
    readonly readDirection: TriplicacaoAuditReadDirection;
    readonly rounds: readonly TriplicacaoAuditRound[];
    readonly zeroDiscards: readonly TriplicacaoZeroDiscardAudit[];
  }): string {
    return [
      'TRIPLICACAO DEBUG',
      `READ_DIRECTION=${report.readDirection}`,
      'PROCESSED_SEQUENCE:',
      ...report.rounds.map((round) => {
        const origin = typeof round.sourceRowIndex === 'number'
          ? ` row=${round.sourceRowIndex} col=${round.sourceColumnIndex}`
          : '';
        return `${round.sequenceIndex}: ${round.roundNumber} ${round.color}${origin}`;
      }),
      'ZERO_DISCARDS:',
      ...(report.zeroDiscards.length === 0
        ? ['none']
        : report.zeroDiscards.map((discard) => `${discard.discardId}: numbers=[${discard.numbers.join(',')}] seq=[${discard.sourceSequenceIndexes.join(',')}] reason=${discard.reason}`)),
    ].join('\n');
  }

  private composeExplainText(report: {
    readonly summaries: readonly TriplicacaoPatternAuditSummary[];
    readonly latestTrios: readonly TriplicacaoAuditTrio[];
    readonly validTrioCount: number;
    readonly discardedZeroTrioCount: number;
  }): string {
    const dominant = report.summaries.reduce((best, current) => {
      if (current.count > best.count) return current;
      if (current.count === best.count && current.frequencyPercent > best.frequencyPercent) return current;
      return best;
    }, report.summaries[0]);

    return [
      'TRIPLICACAO EXPLAIN',
      `DOMINANT_PATTERN=${dominant?.patternKind ?? 'none'}`,
      `DOMINANT_FREQUENCY=${dominant?.frequencyPercent ?? 0}%`,
      `VALID_TRIOS=${report.validTrioCount}`,
      `ZERO_DISCARDS=${report.discardedZeroTrioCount}`,
      'LATEST_EVIDENCE:',
      ...report.latestTrios.map((trio) => `#${trio.trioIndex + 1} ${trio.patternKind} [${trio.colors.join(',')}]`),
      'NOTE=Explainability audit only; no live money authorization.',
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join('\n');
  }

  private lastSeenDistance(
    trios: readonly TriplicacaoAuditTrio[],
    patternKind: TriplicacaoAuditPatternKind,
  ): number | null {
    for (let index = trios.length - 1; index >= 0; index -= 1) {
      if (trios[index].patternKind === patternKind) {
        return trios.length - 1 - index;
      }
    }

    return null;
  }

  private maxConsecutive(
    trios: readonly TriplicacaoAuditTrio[],
    patternKind: TriplicacaoAuditPatternKind,
  ): number {
    let max = 0;
    let current = 0;

    for (const trio of trios) {
      if (trio.patternKind === patternKind) {
        current += 1;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }

    return max;
  }

  private toColor(roundNumber: number): TriplicacaoAuditColor | 'ZERO' {
    if (roundNumber === 0) {
      return 'ZERO';
    }

    if (RED_NUMBERS.has(roundNumber)) {
      return 'RED';
    }

    if (BLACK_NUMBERS.has(roundNumber)) {
      return 'BLACK';
    }

    return 'ZERO';
  }

  private percent(part: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((part / total) * 10000) / 100;
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
