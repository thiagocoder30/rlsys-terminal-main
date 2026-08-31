export type TriplicacaoTargetColor =
  | 'RED'
  | 'BLACK';

export type TriplicacaoTargetPatternKind =
  | 'TC'
  | 'NTC'
  | 'TA'
  | 'NTA';

export interface TriplicacaoTargetResolutionInput {
  readonly patternKind: TriplicacaoTargetPatternKind;
  readonly firstColor: TriplicacaoTargetColor;
  readonly secondColor: TriplicacaoTargetColor;
}

export interface TriplicacaoTargetResolution {
  readonly available: boolean;
  readonly strategyId?: 'TRIPLICACAO_RED' | 'TRIPLICACAO_BLACK';
  readonly target?: TriplicacaoTargetColor;
  readonly patternKind: TriplicacaoTargetPatternKind;
  readonly projection:
    | 'CONTINUATION'
    | 'ALTERNATION'
    | 'UNAVAILABLE';
  readonly rationale: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly automaticEntry: false;
}

export class TriplicacaoTargetResolver {
  public resolve(
    input: TriplicacaoTargetResolutionInput,
  ): TriplicacaoTargetResolution {
    const { patternKind, firstColor, secondColor } = input;

    if (!this.isColor(firstColor) || !this.isColor(secondColor)) {
      return this.unavailable(
        patternKind,
        'Triplicação target resolution requires valid RED/BLACK colors.',
      );
    }

    if (
      (patternKind === 'TC' || patternKind === 'NTC') &&
      firstColor !== secondColor
    ) {
      return this.unavailable(
        patternKind,
        `${patternKind} target doctrine requires equal current colors.`,
      );
    }

    if (
      (patternKind === 'TA' || patternKind === 'NTA') &&
      firstColor === secondColor
    ) {
      return this.unavailable(
        patternKind,
        `${patternKind} target doctrine requires alternating current colors.`,
      );
    }

    const continuation =
      patternKind === 'TC' ||
      patternKind === 'NTA';

    const target = continuation
      ? secondColor
      : this.opposite(secondColor);

    return Object.freeze({
      available: true,
      strategyId:
        target === 'RED'
          ? 'TRIPLICACAO_RED'
          : 'TRIPLICACAO_BLACK',
      target,
      patternKind,
      projection: continuation
        ? 'CONTINUATION'
        : 'ALTERNATION',
      rationale: Object.freeze([
        `Triplicação pattern: ${patternKind}.`,
        continuation
          ? `Historical doctrine continues ${secondColor}.`
          : `Historical doctrine alternates from ${secondColor} to ${target}.`,
        'Target is recommendation-only and requires human operator decision.',
      ]),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      automaticEntry: false,
    });
  }

  private unavailable(
    patternKind: TriplicacaoTargetPatternKind,
    reason: string,
  ): TriplicacaoTargetResolution {
    return Object.freeze({
      available: false,
      patternKind,
      projection: 'UNAVAILABLE',
      rationale: Object.freeze([
        reason,
        'Target resolution failed closed.',
      ]),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      automaticEntry: false,
    });
  }

  private opposite(
    color: TriplicacaoTargetColor,
  ): TriplicacaoTargetColor {
    return color === 'RED'
      ? 'BLACK'
      : 'RED';
  }

  private isColor(
    value: string,
  ): value is TriplicacaoTargetColor {
    return value === 'RED' || value === 'BLACK';
  }
}
