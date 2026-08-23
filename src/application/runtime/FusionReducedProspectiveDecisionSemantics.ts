import type {
  FusionReducedDoctrineSnapshot,
} from './FusionReducedDoctrineEngine.js';


export type FusionReducedProspectiveStatus =
  | 'BLOCKED'
  | 'OBSERVE'
  | 'PAPER_READY';


export interface FusionReducedProspectiveHypothesis {

  readonly strategyId:
    'fusion-reduced';

  readonly targetNumbers:
    readonly number[];

  readonly targetCenter:
    23;

  readonly targetCoverage:
    19;

  readonly createdFor:
    'NEXT_SPIN';

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly automaticExecutionAllowed:
    false;
}


export interface FusionReducedProspectiveDecision {

  readonly status:
    FusionReducedProspectiveStatus;

  readonly hypothesis:
    FusionReducedProspectiveHypothesis | null;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly reasons:
    readonly string[];

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly automaticExecutionAllowed:
    false;
}


export interface FusionReducedEvidence {

  readonly eligible:
    boolean;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly reasons:
    readonly string[];
}


/**
 * Decision semantics da Fusion Reduzida.
 *
 * Esta classe NÃO calcula o alvo.
 *
 * O alvo vem exclusivamente da Doctrine:
 *
 * 23 ± 9 = 19 números
 *
 * Ela apenas interpreta a elegibilidade
 * prospectiva.
 */
export class FusionReducedProspectiveDecisionSemantics {

  public constructor(
    private readonly doctrine:
      FusionReducedDoctrineSnapshot,
  ) {}


  public resolve(
    evidence:
      FusionReducedEvidence,
  ):
    FusionReducedProspectiveDecision {


    if (
      evidence.blockers.length > 0
    ) {
      return this.decision(
        'BLOCKED',
        null,
        evidence,
        [
          'FUSION_REDUCED_BLOCKED_BY_EVIDENCE',
        ],
      );
    }


    if (
      !evidence.eligible
    ) {
      return this.decision(
        'OBSERVE',
        null,
        evidence,
        [
          'FUSION_REDUCED_WAITING_CONFIRMATION',
        ],
      );
    }


    return this.decision(
      'PAPER_READY',
      Object.freeze({
        strategyId:
          'fusion-reduced',

        targetNumbers:
          this.doctrine.targetNumbers,

        targetCenter:
          23,

        targetCoverage:
          19,

        createdFor:
          'NEXT_SPIN',

        paperOnly:
          true,

        recommendationOnly:
          true,

        automaticExecutionAllowed:
          false,
      }),
      evidence,
      [
        'FUSION_REDUCED_PROSPECTIVE_READY',
      ],
    );
  }


  private decision(
    status:
      FusionReducedProspectiveStatus,

    hypothesis:
      FusionReducedProspectiveHypothesis | null,

    evidence:
      FusionReducedEvidence,

    reasons:
      readonly string[],
  ):
    FusionReducedProspectiveDecision {

    return Object.freeze({

      status,

      hypothesis,

      blockers:
        Object.freeze([
          ...evidence.blockers,
        ]),

      warnings:
        Object.freeze([
          ...evidence.warnings,
        ]),

      reasons:
        Object.freeze([
          ...evidence.reasons,
          ...reasons,
        ]),

      paperOnly:
        true,

      recommendationOnly:
        true,

      automaticExecutionAllowed:
        false,
    });
  }
}
