import type {
  TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import type {
  TriplicacaoEnginePatternKind,
} from '../../domain/analytics/TriplicacaoPatternEngine.js';


export type TriplicacaoActionColor =
  | 'RED'
  | 'BLACK';


export type TriplicacaoActionStatus =
  | 'ACTION'
  | 'NO_ACTION'
  | 'ZERO_BLOCKED';


export type TriplicacaoOpeningRelation =
  | 'SAME'
  | 'ALTERNATING';


export interface TriplicacaoActionSemanticsInput {
  readonly analysis:
    TriplicacaoAdvancedProbabilityAnalysis;

  /**
   * First observed position of the prospective trio.
   *
   * This component intentionally does not decide trio alignment.
   * The live coordinator will supply these two positions later.
   */
  readonly firstNumber:
    number;

  /**
   * Second observed position of the prospective trio.
   *
   * The next roulette result would complete the trio.
   */
  readonly secondNumber:
    number;
}


export interface TriplicacaoActionSemanticsResult {
  readonly status:
    TriplicacaoActionStatus;

  readonly selectedPatternKind:
    TriplicacaoEnginePatternKind | null;

  readonly firstNumber:
    number;

  readonly secondNumber:
    number;

  readonly firstColor:
    TriplicacaoActionColor | 'ZERO';

  readonly secondColor:
    TriplicacaoActionColor | 'ZERO';

  readonly openingRelation:
    TriplicacaoOpeningRelation | null;

  readonly targetColor:
    TriplicacaoActionColor | null;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly evidenceScore:
    number;

  readonly rationale:
    string;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


const RED_NUMBERS:
  ReadonlySet<number> =
    new Set([
      1, 3, 5, 7, 9,
      12, 14, 16, 18,
      19, 21, 23, 25,
      27, 30, 32, 34,
      36,
    ]);


const BLACK_NUMBERS:
  ReadonlySet<number> =
    new Set([
      2, 4, 6, 8, 10,
      11, 13, 15, 17,
      20, 22, 24, 26,
      28, 29, 31, 33,
      35,
    ]);


/**
 * Formal action semantics for Triplicação.
 *
 * This resolver does NOT decide whether Triplicação is statistically
 * profitable.
 *
 * The Advanced Probability engine is responsible for deciding whether
 * a pattern hypothesis is strong enough for PAPER_ONLY.
 *
 * This class answers only:
 *
 *   "Given the selected pattern and the first two colors of a new trio,
 *    which color is required on the third spin for that pattern to
 *    complete?"
 *
 * Pattern semantics:
 *
 * TC:
 *   A A -> A
 *
 * NTC:
 *   A A -> B
 *
 * TA:
 *   A B -> A
 *
 * NTA:
 *   A B -> B
 *
 * If the opening pair is incompatible with the selected pattern family,
 * no action is emitted.
 *
 * If either opening spin is zero, the prospective trio is blocked by
 * the existing Triplicação zero rule.
 */
export class TriplicacaoActionSemantics {
  public resolve(
    input:
      TriplicacaoActionSemanticsInput,
  ): TriplicacaoActionSemanticsResult {
    this.validateNumber(
      input.firstNumber,
    );

    this.validateNumber(
      input.secondNumber,
    );

    const analysis =
      input.analysis;

    const firstColor =
      this.toColor(
        input.firstNumber,
      );

    const secondColor =
      this.toColor(
        input.secondNumber,
      );

    if (
      firstColor ===
        'ZERO' ||
      secondColor ===
        'ZERO'
    ) {
      return this.result({
        status:
          'ZERO_BLOCKED',

        analysis,

        firstNumber:
          input.firstNumber,

        secondNumber:
          input.secondNumber,

        firstColor,

        secondColor,

        openingRelation:
          null,

        targetColor:
          null,

        rationale:
          'Zero presente na formação prospectiva. O trio deve ser descartado pela regra da Triplicação.',

        reasons: [
          'TRIPLICACAO_ACTION_ZERO_IN_OPENING',
        ],

        warnings: [
          'TRIPLICACAO_TRIO_DISCARDED_BY_ZERO',
        ],

        blockers: [
          'TRIPLICACAO_ACTION_ZERO_BLOCKED',
        ],
      });
    }

    if (
      analysis.probabilityMode !==
      'PAPER_ONLY'
    ) {
      return this.result({
        status:
          'NO_ACTION',

        analysis,

        firstNumber:
          input.firstNumber,

        secondNumber:
          input.secondNumber,

        firstColor,

        secondColor,

        openingRelation:
          this.openingRelation(
            firstColor,
            secondColor,
          ),

        targetColor:
          null,

        rationale:
          'A engine avançada ainda não autorizou hipótese prospectiva PAPER_ONLY.',

        reasons: [
          `TRIPLICACAO_PROBABILITY_MODE:${analysis.probabilityMode}`,
        ],

        warnings: [
          'TRIPLICACAO_ACTION_REQUIRES_PAPER_ONLY',
        ],

        blockers: [],
      });
    }

    const pattern =
      analysis.selectedPatternKind;

    if (
      pattern ===
      null
    ) {
      return this.result({
        status:
          'NO_ACTION',

        analysis,

        firstNumber:
          input.firstNumber,

        secondNumber:
          input.secondNumber,

        firstColor,

        secondColor,

        openingRelation:
          this.openingRelation(
            firstColor,
            secondColor,
          ),

        targetColor:
          null,

        rationale:
          'Nenhum padrão foi selecionado pela engine avançada.',

        reasons: [
          'TRIPLICACAO_ACTION_NO_SELECTED_PATTERN',
        ],

        warnings: [
          'TRIPLICACAO_ACTION_WAIT_PATTERN',
        ],

        blockers: [],
      });
    }

    const relation =
      this.openingRelation(
        firstColor,
        secondColor,
      );

    const requiredRelation =
      this.requiredOpeningRelation(
        pattern,
      );

    if (
      relation !==
      requiredRelation
    ) {
      return this.result({
        status:
          'NO_ACTION',

        analysis,

        firstNumber:
          input.firstNumber,

        secondNumber:
          input.secondNumber,

        firstColor,

        secondColor,

        openingRelation:
          relation,

        targetColor:
          null,

        rationale:
          `A formação atual ${firstColor}/${secondColor} não pode completar o padrão ${pattern}.`,

        reasons: [
          `TRIPLICACAO_SELECTED_PATTERN:${pattern}`,
          `TRIPLICACAO_OPENING_RELATION:${relation}`,
          `TRIPLICACAO_REQUIRED_OPENING_RELATION:${requiredRelation}`,
        ],

        warnings: [
          'TRIPLICACAO_PATTERN_OPENING_NOT_COMPATIBLE',
        ],

        blockers: [],
      });
    }

    const targetColor =
      this.resolveTargetColor(
        pattern,
        firstColor,
        secondColor,
      );

    return this.result({
      status:
        'ACTION',

      analysis,

      firstNumber:
        input.firstNumber,

      secondNumber:
        input.secondNumber,

      firstColor,

      secondColor,

      openingRelation:
        relation,

      targetColor,

      rationale:
        this.actionRationale({
          pattern,
          firstColor,
          secondColor,
          targetColor,
        }),

      reasons: [
        `TRIPLICACAO_SELECTED_PATTERN:${pattern}`,
        `TRIPLICACAO_OPENING:${firstColor}/${secondColor}`,
        `TRIPLICACAO_TARGET_COLOR:${targetColor}`,
        `TRIPLICACAO_ADVANCED_EVIDENCE:${analysis.advancedEvidenceScore}`,
        `TRIPLICACAO_ADVANCED_CONFIDENCE:${analysis.advancedConfidenceScore}`,
        `TRIPLICACAO_ADVANCED_RISK:${analysis.advancedRiskScore}`,
      ],

      warnings: [
        'TRIPLICACAO_TARGET_IS_PROSPECTIVE_HYPOTHESIS',
      ],

      blockers: [],
    });
  }


  private requiredOpeningRelation(
    pattern:
      TriplicacaoEnginePatternKind,
  ): TriplicacaoOpeningRelation {
    if (
      pattern ===
        'TC' ||
      pattern ===
        'NTC'
    ) {
      return 'SAME';
    }

    return 'ALTERNATING';
  }


  private openingRelation(
    first:
      TriplicacaoActionColor,

    second:
      TriplicacaoActionColor,
  ): TriplicacaoOpeningRelation {
    return first ===
      second
      ? 'SAME'
      : 'ALTERNATING';
  }


  private resolveTargetColor(
    pattern:
      TriplicacaoEnginePatternKind,

    first:
      TriplicacaoActionColor,

    second:
      TriplicacaoActionColor,
  ): TriplicacaoActionColor {
    if (
      pattern ===
      'TC'
    ) {
      return first;
    }

    if (
      pattern ===
      'NTC'
    ) {
      return this.opposite(
        first,
      );
    }

    if (
      pattern ===
      'TA'
    ) {
      return first;
    }

    return second;
  }


  private actionRationale(
    input: {
      readonly pattern:
        TriplicacaoEnginePatternKind;

      readonly firstColor:
        TriplicacaoActionColor;

      readonly secondColor:
        TriplicacaoActionColor;

      readonly targetColor:
        TriplicacaoActionColor;
    },
  ): string {
    if (
      input.pattern ===
      'TC'
    ) {
      return [
        'TC exige três cores iguais.',
        `A abertura ${input.firstColor}/${input.secondColor} é contínua.`,
        `Para completar TC, a terceira cor precisa ser ${input.targetColor}.`,
      ].join(' ');
    }

    if (
      input.pattern ===
      'NTC'
    ) {
      return [
        'NTC exige primeira e segunda cores iguais e terceira diferente.',
        `A abertura ${input.firstColor}/${input.secondColor} é contínua.`,
        `Para completar NTC, a terceira cor precisa ser ${input.targetColor}.`,
      ].join(' ');
    }

    if (
      input.pattern ===
      'TA'
    ) {
      return [
        'TA exige primeira e terceira cores iguais e segunda diferente.',
        `A abertura ${input.firstColor}/${input.secondColor} é alternada.`,
        `Para completar TA, a terceira cor precisa ser ${input.targetColor}.`,
      ].join(' ');
    }

    return [
      'NTA exige primeira cor diferente e segunda e terceira iguais.',
      `A abertura ${input.firstColor}/${input.secondColor} é alternada.`,
      `Para completar NTA, a terceira cor precisa ser ${input.targetColor}.`,
    ].join(' ');
  }


  private opposite(
    color:
      TriplicacaoActionColor,
  ): TriplicacaoActionColor {
    return color ===
      'RED'
      ? 'BLACK'
      : 'RED';
  }


  private toColor(
    number:
      number,
  ):
    | TriplicacaoActionColor
    | 'ZERO' {
    if (
      number ===
      0
    ) {
      return 'ZERO';
    }

    if (
      RED_NUMBERS.has(
        number,
      )
    ) {
      return 'RED';
    }

    if (
      BLACK_NUMBERS.has(
        number,
      )
    ) {
      return 'BLACK';
    }

    throw new Error(
      'triplicacao_action_invalid_number',
    );
  }


  private result(
    input: {
      readonly status:
        TriplicacaoActionStatus;

      readonly analysis:
        TriplicacaoAdvancedProbabilityAnalysis;

      readonly firstNumber:
        number;

      readonly secondNumber:
        number;

      readonly firstColor:
        TriplicacaoActionColor | 'ZERO';

      readonly secondColor:
        TriplicacaoActionColor | 'ZERO';

      readonly openingRelation:
        TriplicacaoOpeningRelation | null;

      readonly targetColor:
        TriplicacaoActionColor | null;

      readonly rationale:
        string;

      readonly reasons:
        readonly string[];

      readonly warnings:
        readonly string[];

      readonly blockers:
        readonly string[];
    },
  ): TriplicacaoActionSemanticsResult {
    return Object.freeze({
      status:
        input.status,

      selectedPatternKind:
        input.analysis
          .selectedPatternKind,

      firstNumber:
        input.firstNumber,

      secondNumber:
        input.secondNumber,

      firstColor:
        input.firstColor,

      secondColor:
        input.secondColor,

      openingRelation:
        input.openingRelation,

      targetColor:
        input.targetColor,

      confidenceScore:
        this.clampRatio(
          input.analysis
            .advancedConfidenceScore,
        ),

      riskScore:
        this.clampRatio(
          input.analysis
            .advancedRiskScore,
        ),

      evidenceScore:
        this.clampScore(
          input.analysis
            .advancedEvidenceScore,
        ),

      rationale:
        input.rationale,

      reasons:
        Object.freeze([
          ...input.reasons,
        ]),

      warnings:
        Object.freeze([
          ...input.warnings,
        ]),

      blockers:
        Object.freeze([
          ...input.blockers,
        ]),

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,

      operatorDecisionRequired:
        true as const,
    });
  }


  private validateNumber(
    number:
      number,
  ): void {
    if (
      !Number.isInteger(
        number,
      ) ||
      number < 0 ||
      number > 36
    ) {
      throw new Error(
        'triplicacao_action_invalid_number',
      );
    }
  }


  private clampRatio(
    value:
      number,
  ): number {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }


  private clampScore(
    value:
      number,
  ): number {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        value,
      ),
    );
  }
}
