import {
  PaperRuntimeV1Certification,
  type PaperRuntimeV1CertificationInput,
  type PaperRuntimeV1CertificationResult,
} from './PaperRuntimeV1Certification.js';

import {
  PaperRuntimeEnduranceEvidenceResolver,
  type PaperRuntimeEnduranceEvidence,
  type PaperRuntimeEnduranceEvidenceInput,
} from './PaperRuntimeEnduranceEvidenceResolver.js';

import {
  PaperSessionInitialRiskEvaluator,
  type PaperSessionInitialRiskEvaluationReport,
} from './PaperSessionInitialRiskEvaluator.js';

import {
  PaperRuntimeReadinessResolver,
  type PaperRuntimeReadinessResolution,
} from './PaperRuntimeReadinessResolver.js';

import type {
  PaperSessionOperatorConfigurationSnapshot,
} from './PaperSessionOperatorConfiguration.js';

import type {
  PaperRuntimeSessionState,
} from './PaperRuntimeOperationalGate.js';


export interface PaperRuntimeReadinessComposerInput {
  readonly configuration:
    PaperSessionOperatorConfigurationSnapshot;

  readonly runtimeCertification:
    PaperRuntimeV1CertificationInput;

  readonly endurance:
    PaperRuntimeEnduranceEvidenceInput;

  readonly operatorSupervised: boolean;

  readonly sessionState:
    PaperRuntimeSessionState;

  readonly nowEpochMs?: number;
}


export interface PaperRuntimeReadinessComposerReport {
  readonly runtimeCertification:
    PaperRuntimeV1CertificationResult;

  readonly endurance:
    PaperRuntimeEnduranceEvidence;

  readonly risk:
    PaperSessionInitialRiskEvaluationReport;

  readonly readiness:
    PaperRuntimeReadinessResolution;

  readonly readyForPrepare: boolean;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Composes the real institutional evidence required before PAPER PREPARE.
 *
 * The component does not:
 * - read endurance files from disk;
 * - invent certification results;
 * - invent risk readiness;
 * - execute PREPARE;
 * - authorize live money.
 *
 * It only invokes existing evidence producers and feeds their results into
 * PaperRuntimeReadinessResolver.
 *
 * Complexity:
 * - O(n log n), dominated by endurance report analysis.
 * - Memory O(n), where n is endurance evidence count.
 */
export class PaperRuntimeReadinessComposer {
  public constructor(
    private readonly runtimeCertification:
      PaperRuntimeV1Certification =
        new PaperRuntimeV1Certification(),

    private readonly enduranceResolver:
      PaperRuntimeEnduranceEvidenceResolver =
        new PaperRuntimeEnduranceEvidenceResolver(),

    private readonly riskEvaluator:
      PaperSessionInitialRiskEvaluator =
        new PaperSessionInitialRiskEvaluator(),

    private readonly readinessResolver:
      PaperRuntimeReadinessResolver =
        new PaperRuntimeReadinessResolver(),
  ) {}


  public compose(
    input:
      PaperRuntimeReadinessComposerInput,
  ): PaperRuntimeReadinessComposerReport {
    const runtimeCertification =
      this.runtimeCertification.certify(
        input.runtimeCertification,
      );

    const endurance =
      this.enduranceResolver.resolve(
        input.endurance,
      );

    const risk =
      this.riskEvaluator.evaluate({
        configuration:
          input.configuration,

        nowEpochMs:
          input.nowEpochMs,
      });

    const readiness =
      this.readinessResolver.resolve({
        runtimeCertification,

        endurance: {
          status:
            endurance.status,
        },

        riskDecision: {
          verdict:
            risk.decision.verdict,

          reason:
            risk.decision.reason,
        },

        operatorSupervised:
          input.operatorSupervised,

        sessionState:
          input.sessionState,
      });

    return Object.freeze({
      runtimeCertification,

      endurance,

      risk,

      readiness,

      readyForPrepare:
        readiness.readyForPrepare,

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticExecutionAllowed:
        false as const,

      humanSupervisionRequired:
        true as const,
    });
  }
}
