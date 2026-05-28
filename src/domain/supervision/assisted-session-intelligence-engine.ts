export type AssistedSessionMode =
  | 'OBSERVE'
  | 'ASSIST'
  | 'VETO'
  | 'COOLDOWN'
  | 'INTERRUPT';

export type AssistedSessionGate = 'BLOCKED';

export interface AssistedSessionIntelligenceInput {
  readonly sessionId?: string;
  readonly tableQualificationScore?: number;
  readonly hybridConsensusScore?: number;
  readonly operatorReadinessScore?: number;
  readonly strategyRiskWeight?: number;
  readonly cooldownActive?: boolean;
}

export interface AssistedSessionIntelligenceReport {
  readonly sessionId: string;
  readonly mode: AssistedSessionMode;
  readonly riskPressure: number;
  readonly requiresCooldown: boolean;
  readonly gate: AssistedSessionGate;
  readonly operationalGate: AssistedSessionGate;
  readonly paperSessionGate: AssistedSessionGate;
  readonly liveSessionGate: AssistedSessionGate;
  readonly canSuggest: boolean;
  readonly canExplain: boolean;
  readonly canVeto: boolean;
  readonly canInterrupt: boolean;
  readonly reasons: readonly string[];
}

export class AssistedSessionIntelligenceEngine {
  public evaluate(
    input: AssistedSessionIntelligenceInput
  ): AssistedSessionIntelligenceReport {
    const tableQualificationScore =
      this.normalizeScore(input.tableQualificationScore);

    const hybridConsensusScore =
      this.normalizeScore(input.hybridConsensusScore);

    const operatorReadinessScore =
      this.normalizeScore(input.operatorReadinessScore);

    const strategyRiskWeight =
      this.normalizeScore(input.strategyRiskWeight, 100);

    const riskPressure = this.calculateRiskPressure(
      tableQualificationScore,
      hybridConsensusScore,
      operatorReadinessScore,
      strategyRiskWeight,
      input.cooldownActive === true
    );

    const mode = this.classify(
      tableQualificationScore,
      hybridConsensusScore,
      operatorReadinessScore,
      strategyRiskWeight,
      input.cooldownActive === true,
      riskPressure
    );

    return Object.freeze({
      sessionId:
        typeof input.sessionId === 'string' &&
        input.sessionId.trim().length > 0
          ? input.sessionId.trim()
          : 'assisted-session-runtime',

      mode,

      riskPressure: this.round(riskPressure),

      requiresCooldown:
        mode === 'COOLDOWN' ||
        mode === 'INTERRUPT',

      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',

      canSuggest: mode === 'ASSIST',

      canExplain: true,

      canVeto:
        mode === 'VETO' ||
        mode === 'COOLDOWN' ||
        mode === 'INTERRUPT',

      canInterrupt:
        mode === 'INTERRUPT',

      reasons: this.reasonsFor(
        mode,
        riskPressure
      )
    });
  }

  public analyze(
    input: AssistedSessionIntelligenceInput
  ): AssistedSessionIntelligenceReport {
    return this.evaluate(input);
  }

  public execute(
    input: AssistedSessionIntelligenceInput
  ): AssistedSessionIntelligenceReport {
    return this.evaluate(input);
  }

  private classify(
    tableQualificationScore: number,
    hybridConsensusScore: number,
    operatorReadinessScore: number,
    strategyRiskWeight: number,
    cooldownActive: boolean,
    riskPressure: number
  ): AssistedSessionMode {
    if (
      cooldownActive ||
      riskPressure >= 90
    ) {
      return 'INTERRUPT';
    }

    if (riskPressure >= 70) {
      return 'COOLDOWN';
    }

    if (
      strategyRiskWeight >= 75 ||
      operatorReadinessScore < 35
    ) {
      return 'VETO';
    }

    if (
      tableQualificationScore >= 65 &&
      hybridConsensusScore >= 70 &&
      operatorReadinessScore >= 70 &&
      strategyRiskWeight <= 45
    ) {
      return 'ASSIST';
    }

    return 'OBSERVE';
  }

  private calculateRiskPressure(
    tableQualificationScore: number,
    hybridConsensusScore: number,
    operatorReadinessScore: number,
    strategyRiskWeight: number,
    cooldownActive: boolean
  ): number {
    return this.clamp(
      (100 - operatorReadinessScore) * 0.35 +
      strategyRiskWeight * 0.30 +
      (100 - hybridConsensusScore) * 0.20 +
      (100 - tableQualificationScore) * 0.15 +
      (cooldownActive ? 25 : 0),
      0,
      100
    );
  }

  private reasonsFor(
    mode: AssistedSessionMode,
    riskPressure: number
  ): readonly string[] {
    const reasons: string[] = [];

    if (mode === 'ASSIST') {
      reasons.push(
        'ASSISTED_SESSION_CONTEXT_ELIGIBLE'
      );
    }

    if (mode === 'OBSERVE') {
      reasons.push(
        'ASSISTED_SESSION_OBSERVATION_ONLY'
      );
    }

    if (mode === 'VETO') {
      reasons.push(
        'DEFENSIVE_VETO_TRIGGERED'
      );
    }

    if (mode === 'COOLDOWN') {
      reasons.push(
        'COOLDOWN_REQUIRED'
      );
    }

    if (mode === 'INTERRUPT') {
      reasons.push(
        'SESSION_INTERRUPTION_TRIGGERED'
      );
    }

    if (riskPressure >= 70) {
      reasons.push(
        'HIGH_RISK_PRESSURE'
      );
    }

    return Object.freeze(reasons);
  }

  private normalizeScore(
    value: number | undefined,
    fallback = 0
  ): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      return fallback;
    }

    return this.round(
      this.clamp(value, 0, 100)
    );
  }

  private clamp(
    value: number,
    minimum: number,
    maximum: number
  ): number {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
