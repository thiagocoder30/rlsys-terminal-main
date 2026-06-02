export type InstitutionalConsensusSignalKind =
  | 'WARMUP'
  | 'MOMENTUM'
  | 'VOLATILITY'
  | 'CLUSTER'
  | 'CONFIDENCE'
  | 'COOLDOWN'
  | 'READINESS_GATE'
  | 'OPERATOR'
  | 'PERFORMANCE';

export type InstitutionalConsensusVote =
  | 'SUPPORT'
  | 'OBSERVE'
  | 'BLOCK';

export type InstitutionalConsensusDecision =
  | 'PAPER_CONSENSUS_BLOCKED'
  | 'PAPER_CONSENSUS_OBSERVE'
  | 'PAPER_CONSENSUS_READY'
  | 'PAPER_CONSENSUS_CERTIFIED';

export type InstitutionalConsensusReason =
  | 'INSTITUTIONAL_CONSENSUS_COMPUTED'
  | 'INVALID_INSTITUTIONAL_CONSENSUS_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface InstitutionalConsensusSignal {
  readonly id: string;
  readonly kind: InstitutionalConsensusSignalKind;
  readonly vote: InstitutionalConsensusVote;
  readonly confidence: number;
  readonly weight: number;
  readonly explanation: string;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalConsensusPolicy {
  readonly minimumSignals: number;
  readonly minimumSupportScoreForReady: number;
  readonly minimumSupportScoreForCertified: number;
  readonly maximumBlockScoreForReady: number;
  readonly maximumObserveScoreForCertified: number;
  readonly requireReadinessGateSupport: boolean;
}

export interface InstitutionalConsensusInput {
  readonly sessionId: string;
  readonly signals: readonly InstitutionalConsensusSignal[];
  readonly policy: InstitutionalConsensusPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalConsensusReport {
  readonly sessionId: string;
  readonly decision: InstitutionalConsensusDecision;
  readonly supportScore: number;
  readonly observeScore: number;
  readonly blockScore: number;
  readonly normalizedConfidence: number;
  readonly readinessGateSupport: boolean;
  readonly totalSignals: number;
  readonly supportingSignals: number;
  readonly observingSignals: number;
  readonly blockingSignals: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type InstitutionalConsensusResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalConsensusReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: InstitutionalConsensusReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * InstitutionalConsensusRuntime
 *
 * Consolida sinais institucionais normalizados em uma decisão única PAPER.
 * Não calcula aposta, não abre entrada e não autoriza live money.
 *
 * Complexidade: O(n), memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class InstitutionalConsensusRuntime {
  public evaluate(input: InstitutionalConsensusInput): InstitutionalConsensusResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Institutional consensus cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.signals)) {
      for (const signal of input.signals) {
        if (signal.productionMoneyAllowed === true || signal.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Consensus signal cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_CONSENSUS_INPUT', invalidReason);
    }

    let totalWeight = 0;
    let supportWeighted = 0;
    let observeWeighted = 0;
    let blockWeighted = 0;
    let confidenceWeighted = 0;
    let supportingSignals = 0;
    let observingSignals = 0;
    let blockingSignals = 0;
    let readinessGateSupport = false;

    for (const signal of input.signals) {
      totalWeight += signal.weight;
      confidenceWeighted += signal.confidence * signal.weight;

      if (signal.vote === 'SUPPORT') {
        supportWeighted += signal.confidence * signal.weight;
        supportingSignals += 1;
      } else if (signal.vote === 'OBSERVE') {
        observeWeighted += signal.confidence * signal.weight;
        observingSignals += 1;
      } else {
        blockWeighted += signal.confidence * signal.weight;
        blockingSignals += 1;
      }

      if (signal.kind === 'READINESS_GATE' && signal.vote === 'SUPPORT') {
        readinessGateSupport = true;
      }
    }

    const supportScore = totalWeight > 0 ? supportWeighted / totalWeight : 0;
    const observeScore = totalWeight > 0 ? observeWeighted / totalWeight : 0;
    const blockScore = totalWeight > 0 ? blockWeighted / totalWeight : 0;
    const normalizedConfidence = totalWeight > 0 ? confidenceWeighted / totalWeight : 0;

    const decision = this.classify(input.policy, {
      totalSignals: input.signals.length,
      supportScore,
      observeScore,
      blockScore,
      readinessGateSupport,
    });

    return {
      ok: true,
      value: {
        sessionId: input.sessionId,
        decision,
        supportScore: this.roundScore(supportScore),
        observeScore: this.roundScore(observeScore),
        blockScore: this.roundScore(blockScore),
        normalizedConfidence: this.roundScore(normalizedConfidence),
        readinessGateSupport,
        totalSignals: input.signals.length,
        supportingSignals,
        observingSignals,
        blockingSignals,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(decision),
      },
    };
  }

  private classify(
    policy: InstitutionalConsensusPolicy,
    metrics: {
      readonly totalSignals: number;
      readonly supportScore: number;
      readonly observeScore: number;
      readonly blockScore: number;
      readonly readinessGateSupport: boolean;
    },
  ): InstitutionalConsensusDecision {
    if (
      metrics.totalSignals < policy.minimumSignals ||
      metrics.blockScore > policy.maximumBlockScoreForReady ||
      (policy.requireReadinessGateSupport && !metrics.readinessGateSupport)
    ) {
      return 'PAPER_CONSENSUS_BLOCKED';
    }

    if (
      metrics.supportScore >= policy.minimumSupportScoreForCertified &&
      metrics.observeScore <= policy.maximumObserveScoreForCertified
    ) {
      return 'PAPER_CONSENSUS_CERTIFIED';
    }

    if (metrics.supportScore >= policy.minimumSupportScoreForReady) {
      return 'PAPER_CONSENSUS_READY';
    }

    return 'PAPER_CONSENSUS_OBSERVE';
  }

  private explain(decision: InstitutionalConsensusDecision): string {
    if (decision === 'PAPER_CONSENSUS_CERTIFIED') {
      return 'Consenso institucional certificado para operação PAPER supervisionada.';
    }

    if (decision === 'PAPER_CONSENSUS_READY') {
      return 'Consenso institucional favorável para PAPER, ainda sem certificação plena.';
    }

    if (decision === 'PAPER_CONSENSUS_OBSERVE') {
      return 'Consenso institucional exige observação antes de autorização PAPER.';
    }

    return 'Consenso institucional bloqueado por risco, amostra insuficiente ou readiness gate não favorável.';
  }

  private validateInput(input: InstitutionalConsensusInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!Array.isArray(input.signals) || input.signals.length === 0 || input.signals.length > 1000) {
      return 'signals must contain 1 to 1000 normalized consensus signals.';
    }

    for (const signal of input.signals) {
      const validation = this.validateSignal(signal);

      if (validation !== null) {
        return validation;
      }
    }

    if (typeof input.policy !== 'object' || input.policy === null) {
      return 'policy must be provided.';
    }

    if (!Number.isInteger(input.policy.minimumSignals) || input.policy.minimumSignals < 1) {
      return 'policy.minimumSignals must be a positive integer.';
    }

    if (!this.isScore(input.policy.minimumSupportScoreForReady)) {
      return 'policy.minimumSupportScoreForReady must be between 0 and 1.';
    }

    if (!this.isScore(input.policy.minimumSupportScoreForCertified)) {
      return 'policy.minimumSupportScoreForCertified must be between 0 and 1.';
    }

    if (!this.isScore(input.policy.maximumBlockScoreForReady)) {
      return 'policy.maximumBlockScoreForReady must be between 0 and 1.';
    }

    if (!this.isScore(input.policy.maximumObserveScoreForCertified)) {
      return 'policy.maximumObserveScoreForCertified must be between 0 and 1.';
    }

    if (input.policy.minimumSupportScoreForReady > input.policy.minimumSupportScoreForCertified) {
      return 'minimumSupportScoreForReady cannot be greater than minimumSupportScoreForCertified.';
    }

    if (typeof input.policy.requireReadinessGateSupport !== 'boolean') {
      return 'policy.requireReadinessGateSupport must be boolean.';
    }

    return null;
  }

  private validateSignal(signal: InstitutionalConsensusSignal): string | null {
    if (typeof signal !== 'object' || signal === null) {
      return 'each signal must be an object.';
    }

    if (!this.isSafeToken(signal.id, 3, 128)) {
      return 'signal.id must be a safe token with 3 to 128 characters.';
    }

    if (!this.isKnownKind(signal.kind)) {
      return 'signal.kind is invalid.';
    }

    if (signal.vote !== 'SUPPORT' && signal.vote !== 'OBSERVE' && signal.vote !== 'BLOCK') {
      return 'signal.vote must be SUPPORT, OBSERVE, or BLOCK.';
    }

    if (!this.isScore(signal.confidence)) {
      return 'signal.confidence must be between 0 and 1.';
    }

    if (!Number.isFinite(signal.weight) || signal.weight <= 0 || signal.weight > 100) {
      return 'signal.weight must be a positive finite number up to 100.';
    }

    if (typeof signal.explanation !== 'string' || signal.explanation.trim().length < 3) {
      return 'signal.explanation must be a meaningful string.';
    }

    return null;
  }

  private isKnownKind(kind: InstitutionalConsensusSignalKind): boolean {
    return (
      kind === 'WARMUP' ||
      kind === 'MOMENTUM' ||
      kind === 'VOLATILITY' ||
      kind === 'CLUSTER' ||
      kind === 'CONFIDENCE' ||
      kind === 'COOLDOWN' ||
      kind === 'READINESS_GATE' ||
      kind === 'OPERATOR' ||
      kind === 'PERFORMANCE'
    );
  }

  private isScore(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private fail(reason: InstitutionalConsensusReason, message: string): InstitutionalConsensusResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
