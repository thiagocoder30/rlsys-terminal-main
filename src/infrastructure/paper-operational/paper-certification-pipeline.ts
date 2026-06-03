export type PaperCertificationPipelineStatus =
  | 'PAPER_CERTIFIED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export type PaperCertificationPipelineReason =
  | 'POLICY_LOCK_ACTIVE'
  | 'EMPTY_SESSION'
  | 'READINESS_BLOCKED'
  | 'CONSENSUS_BLOCKED'
  | 'RISK_BLOCKED'
  | 'OPERATOR_BLOCKED'
  | 'CERTIFICATION_PASSED'
  | 'CERTIFICATION_REQUIRES_REVIEW';

export interface PaperCertificationPipelineInput {
  readonly sessionId: string;
  readonly warmupRounds: number;
  readonly readinessApproved: boolean;
  readonly institutionalConsensusApproved: boolean;
  readonly riskApproved: boolean;
  readonly operatorApproved: boolean;
  readonly minimumWarmupRounds: number;
  readonly confidenceScore: number;
  readonly minimumConfidenceScore: number;
}

export interface PaperCertificationPipelinePolicy {
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface PaperCertificationPipelineOutput {
  readonly sessionId: string;
  readonly status: PaperCertificationPipelineStatus;
  readonly reasons: readonly PaperCertificationPipelineReason[];
  readonly confidenceScore: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface PaperCertificationPipelineFailure {
  readonly code: 'INVALID_CERTIFICATION_INPUT';
  readonly message: string;
}

export type PaperCertificationPipelineResult =
  | {
      readonly ok: true;
      readonly value: PaperCertificationPipelineOutput;
    }
  | {
      readonly ok: false;
      readonly error: PaperCertificationPipelineFailure;
    };

const DEFENSIVE_POLICY: PaperCertificationPipelinePolicy = Object.freeze({
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const blockedOutput = (
  input: PaperCertificationPipelineInput,
  reasons: readonly PaperCertificationPipelineReason[],
): PaperCertificationPipelineOutput => ({
  sessionId: input.sessionId,
  status: 'BLOCKED',
  reasons,
  confidenceScore: input.confidenceScore,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
  paperOnly: true,
});

const reviewOutput = (
  input: PaperCertificationPipelineInput,
  reasons: readonly PaperCertificationPipelineReason[],
): PaperCertificationPipelineOutput => ({
  sessionId: input.sessionId,
  status: 'NEEDS_REVIEW',
  reasons,
  confidenceScore: input.confidenceScore,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
  paperOnly: true,
});

const certifiedOutput = (
  input: PaperCertificationPipelineInput,
): PaperCertificationPipelineOutput => ({
  sessionId: input.sessionId,
  status: 'PAPER_CERTIFIED',
  reasons: ['CERTIFICATION_PASSED'],
  confidenceScore: input.confidenceScore,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
  paperOnly: true,
});

export class PaperCertificationPipeline {
  private readonly policy: PaperCertificationPipelinePolicy;

  public constructor(policy: PaperCertificationPipelinePolicy = DEFENSIVE_POLICY) {
    this.policy = Object.freeze({
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  public certify(
    input: PaperCertificationPipelineInput,
  ): PaperCertificationPipelineResult {
    const validationFailure = this.validateInput(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const policyReasons = this.evaluatePolicy();

    if (policyReasons.length > 0) {
      return {
        ok: true,
        value: blockedOutput(input, policyReasons),
      };
    }

    const blockingReasons = this.evaluateBlockingReasons(input);

    if (blockingReasons.length > 0) {
      return {
        ok: true,
        value: blockedOutput(input, blockingReasons),
      };
    }

    if (input.confidenceScore < input.minimumConfidenceScore) {
      return {
        ok: true,
        value: reviewOutput(input, ['CERTIFICATION_REQUIRES_REVIEW']),
      };
    }

    return {
      ok: true,
      value: certifiedOutput(input),
    };
  }

  private evaluatePolicy(): readonly PaperCertificationPipelineReason[] {
    const reasons: PaperCertificationPipelineReason[] = [];

    if (this.policy.productionMoneyAllowed) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    return reasons;
  }

  private evaluateBlockingReasons(
    input: PaperCertificationPipelineInput,
  ): readonly PaperCertificationPipelineReason[] {
    const reasons: PaperCertificationPipelineReason[] = [];

    if (input.warmupRounds < input.minimumWarmupRounds) {
      reasons.push('EMPTY_SESSION');
    }

    if (!input.readinessApproved) {
      reasons.push('READINESS_BLOCKED');
    }

    if (!input.institutionalConsensusApproved) {
      reasons.push('CONSENSUS_BLOCKED');
    }

    if (!input.riskApproved) {
      reasons.push('RISK_BLOCKED');
    }

    if (!input.operatorApproved) {
      reasons.push('OPERATOR_BLOCKED');
    }

    return reasons;
  }

  private validateInput(
    input: PaperCertificationPipelineInput,
  ): PaperCertificationPipelineFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_CERTIFICATION_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.warmupRounds < 0 || input.minimumWarmupRounds < 0) {
      return {
        code: 'INVALID_CERTIFICATION_INPUT',
        message: 'round counters must not be negative',
      };
    }

    if (input.confidenceScore < 0 || input.confidenceScore > 1) {
      return {
        code: 'INVALID_CERTIFICATION_INPUT',
        message: 'confidenceScore must be between 0 and 1',
      };
    }

    if (input.minimumConfidenceScore < 0 || input.minimumConfidenceScore > 1) {
      return {
        code: 'INVALID_CERTIFICATION_INPUT',
        message: 'minimumConfidenceScore must be between 0 and 1',
      };
    }

    return null;
  }
}
