import type {
  PaperRuntimeV1CertificationResult,
} from './PaperRuntimeV1Certification.js';

import type {
  RuntimeEnduranceCliReport,
} from './RuntimeEnduranceCliReporter.js';

import type {
  RuntimeRiskDecisionResult,
} from './RuntimeRiskDecisionGateway.js';

import type {
  PaperRuntimeEnduranceStatus,
  PaperRuntimeOperatorMode,
  PaperRuntimeRiskReadiness,
  PaperRuntimeSessionState,
} from './PaperRuntimeOperationalGate.js';


export interface PaperRuntimeReadinessResolverInput {
  readonly runtimeCertification:
    PaperRuntimeV1CertificationResult;

  readonly endurance:
    Pick<RuntimeEnduranceCliReport, 'status'>;

  readonly riskDecision:
    Pick<RuntimeRiskDecisionResult, 'verdict' | 'reason'>;

  readonly operatorSupervised: boolean;

  readonly sessionState:
    PaperRuntimeSessionState;
}


export interface PaperRuntimeReadinessResolution {
  readonly runtimePaperAvailable: boolean;

  readonly enduranceStatus:
    PaperRuntimeEnduranceStatus;

  readonly riskReadiness:
    PaperRuntimeRiskReadiness;

  readonly operatorMode:
    PaperRuntimeOperatorMode;

  readonly sessionState:
    PaperRuntimeSessionState;

  readonly readyForPrepare: boolean;

  readonly blockers: readonly string[];

  readonly warnings: readonly string[];

  readonly evidence: readonly string[];

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Translates existing institutional runtime evidence into the exact
 * readiness contract consumed by PaperRuntimeOperationalGate and
 * PaperRuntimeSessionSupervisor.
 *
 * This component does not:
 * - certify the runtime;
 * - run endurance tests;
 * - calculate bankroll/risk decisions;
 * - authorize a PAPER session;
 * - authorize live money;
 * - execute commands.
 *
 * It only maps already-produced institutional facts.
 *
 * Complexity:
 * - Time: O(1)
 * - Memory: O(1)
 */
export class PaperRuntimeReadinessResolver {
  public resolve(
    input: PaperRuntimeReadinessResolverInput,
  ): PaperRuntimeReadinessResolution {
    this.validate(input);

    const runtimePaperAvailable =
      input.runtimeCertification.status ===
        'CERTIFIED' &&
      input.runtimeCertification.certified ===
        true;

    const enduranceStatus =
      this.mapEndurance(
        input.endurance.status,
      );

    const riskReadiness =
      this.mapRisk(
        input.riskDecision.verdict,
      );

    const operatorMode:
      PaperRuntimeOperatorMode =
        input.operatorSupervised
          ? 'SUPERVISED'
          : 'UNSUPERVISED';

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!runtimePaperAvailable) {
      blockers.push(
        'PAPER_RUNTIME_NOT_CERTIFIED',
      );
    }

    if (
      enduranceStatus === 'FAILED' ||
      enduranceStatus === 'NO_DATA'
    ) {
      blockers.push(
        `ENDURANCE_${enduranceStatus}`,
      );
    }

    if (riskReadiness === 'BLOCKED') {
      blockers.push(
        `RISK_BLOCKED:${input.riskDecision.reason}`,
      );
    }

    if (
      input.sessionState === 'FINISHED'
    ) {
      blockers.push(
        'SESSION_ALREADY_FINISHED',
      );
    }

    if (
      enduranceStatus === 'WARNING'
    ) {
      warnings.push(
        'ENDURANCE_WARNING',
      );
    }

    if (
      riskReadiness === 'CAUTION'
    ) {
      warnings.push(
        `RISK_CAUTION:${input.riskDecision.reason}`,
      );
    }

    if (
      operatorMode === 'UNSUPERVISED'
    ) {
      warnings.push(
        'OPERATOR_SUPERVISION_REQUIRED',
      );
    }

    const readyForPrepare =
      blockers.length === 0 &&
      operatorMode === 'SUPERVISED';

    return Object.freeze({
      runtimePaperAvailable,
      enduranceStatus,
      riskReadiness,
      operatorMode,
      sessionState:
        input.sessionState,
      readyForPrepare,
      blockers:
        Object.freeze([...blockers]),
      warnings:
        Object.freeze([...warnings]),
      evidence:
        Object.freeze([
          `RUNTIME_CERTIFICATION:${input.runtimeCertification.status}`,
          `RUNTIME_CERTIFICATION_SCORE:${input.runtimeCertification.score}`,
          `ENDURANCE:${input.endurance.status}`,
          `RISK:${input.riskDecision.verdict}`,
          `OPERATOR_MODE:${operatorMode}`,
          `SESSION_STATE:${input.sessionState}`,
        ]),
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }


  private mapEndurance(
    status:
      RuntimeEnduranceCliReport['status'],
  ): PaperRuntimeEnduranceStatus {
    if (status === 'READY') {
      return 'CERTIFIED';
    }

    if (status === 'WARNING') {
      return 'WARNING';
    }

    if (status === 'FAILED') {
      return 'FAILED';
    }

    return 'NO_DATA';
  }


  private mapRisk(
    verdict:
      RuntimeRiskDecisionResult['verdict'],
  ): PaperRuntimeRiskReadiness {
    if (verdict === 'RISK_ALLOW') {
      return 'READY';
    }

    if (verdict === 'RISK_REVIEW') {
      return 'CAUTION';
    }

    return 'BLOCKED';
  }


  private validate(
    input: PaperRuntimeReadinessResolverInput,
  ): void {
    if (
      typeof input.operatorSupervised !==
      'boolean'
    ) {
      throw new Error(
        'paper_runtime_readiness_invalid_operator_supervision',
      );
    }

    if (
      input.runtimeCertification.status !==
        'CERTIFIED' &&
      input.runtimeCertification.status !==
        'FAILED'
    ) {
      throw new Error(
        'paper_runtime_readiness_invalid_runtime_certification',
      );
    }

    if (
      input.endurance.status !== 'READY' &&
      input.endurance.status !== 'WARNING' &&
      input.endurance.status !== 'FAILED' &&
      input.endurance.status !== 'NO_DATA'
    ) {
      throw new Error(
        'paper_runtime_readiness_invalid_endurance',
      );
    }

    if (
      input.riskDecision.verdict !==
        'RISK_ALLOW' &&
      input.riskDecision.verdict !==
        'RISK_REVIEW' &&
      input.riskDecision.verdict !==
        'RISK_BLOCK'
    ) {
      throw new Error(
        'paper_runtime_readiness_invalid_risk_decision',
      );
    }

    if (
      typeof input.riskDecision.reason !==
        'string'
    ) {
      throw new Error(
        'paper_runtime_readiness_invalid_risk_reason',
      );
    }
  }
}
