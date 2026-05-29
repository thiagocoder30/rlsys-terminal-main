export type InstitutionalAuditDecisionType =
  | 'OBSERVATION_ONLY'
  | 'ASSISTED_SUGGESTION'
  | 'SUPERVISOR_VETO'
  | 'COOLDOWN_TRIGGERED'
  | 'SESSION_INTERRUPTED';

export type InstitutionalAuditVerdict =
  | 'OBSERVED'
  | 'ASSISTED'
  | 'VETOED'
  | 'COOLDOWN'
  | 'INTERRUPTED'
  | 'NON_COMPLIANT';

export type InstitutionalAuditGate = 'BLOCKED';

export interface InstitutionalAuditDecision {
  readonly decisionId: string;
  readonly timestamp: number;
  readonly type: InstitutionalAuditDecisionType;
  readonly reason: string;
  readonly evidenceScore?: number;
  readonly riskPressure?: number;
}

export interface InstitutionalAuditInput {
  readonly auditId?: string;
  readonly sessionId?: string;
  readonly replayId?: string;
  readonly decisions: readonly InstitutionalAuditDecision[];
}

export interface InstitutionalAuditCounters {
  readonly observations: number;
  readonly suggestions: number;
  readonly vetoes: number;
  readonly cooldowns: number;
  readonly interruptions: number;
}

export interface InstitutionalAuditFinding {
  readonly sequence: number;
  readonly decisionId: string;
  readonly type: InstitutionalAuditDecisionType;
  readonly severity: 'INFO' | 'WARNING' | 'BLOCKING' | 'TERMINAL';
  readonly reason: string;
  readonly evidenceScore: number;
  readonly riskPressure: number;
}

export interface InstitutionalAuditReport {
  readonly auditId: string;
  readonly sessionId: string;
  readonly replayId: string;
  readonly decisionsAudited: number;
  readonly finalVerdict: InstitutionalAuditVerdict;
  readonly complianceScore: number;
  readonly averageEvidenceScore: number;
  readonly highestRiskPressure: number;
  readonly hasBlockingDecision: boolean;
  readonly counters: InstitutionalAuditCounters;
  readonly findings: readonly InstitutionalAuditFinding[];
  readonly gate: InstitutionalAuditGate;
  readonly operationalGate: InstitutionalAuditGate;
  readonly paperSessionGate: InstitutionalAuditGate;
  readonly liveSessionGate: InstitutionalAuditGate;
  readonly liveMoneyAuthorized: false;
  readonly auditTrail: readonly string[];
}

const MAX_AUDIT_DECISIONS = 600;

export class InstitutionalAuditEngine {
  public audit(input: InstitutionalAuditInput): InstitutionalAuditReport {
    this.assertInput(input);

    const auditId = this.resolveId(input.auditId, 'institutional-audit-runtime');
    const sessionId = this.resolveId(input.sessionId, 'institutional-session-runtime');
    const replayId = this.resolveId(input.replayId, 'institutional-replay-runtime');
    const decisions = input.decisions.slice(0, MAX_AUDIT_DECISIONS);

    let observations = 0;
    let suggestions = 0;
    let vetoes = 0;
    let cooldowns = 0;
    let interruptions = 0;
    let highestRiskPressure = 0;
    let evidenceSum = 0;
    let integrityPenalty = input.decisions.length > MAX_AUDIT_DECISIONS ? 10 : 0;
    let previousTimestamp = Number.NEGATIVE_INFINITY;

    const findings: InstitutionalAuditFinding[] = [];

    for (let index = 0; index < decisions.length; index += 1) {
      const decision = decisions[index];
      this.assertDecision(decision);

      if (decision.timestamp < previousTimestamp) {
        integrityPenalty += 8;
      }

      previousTimestamp = decision.timestamp;

      const evidenceScore = this.normalizeScore(decision.evidenceScore, 100);
      const riskPressure = this.normalizeScore(decision.riskPressure, 0);

      highestRiskPressure = Math.max(highestRiskPressure, riskPressure);
      evidenceSum += evidenceScore;

      switch (decision.type) {
        case 'OBSERVATION_ONLY':
          observations += 1;
          break;
        case 'ASSISTED_SUGGESTION':
          suggestions += 1;
          break;
        case 'SUPERVISOR_VETO':
          vetoes += 1;
          break;
        case 'COOLDOWN_TRIGGERED':
          cooldowns += 1;
          break;
        case 'SESSION_INTERRUPTED':
          interruptions += 1;
          break;
      }

      findings.push(Object.freeze({
        sequence: index + 1,
        decisionId: decision.decisionId,
        type: decision.type,
        severity: this.severityFor(decision.type, riskPressure),
        reason: decision.reason.trim(),
        evidenceScore,
        riskPressure
      }));
    }

    const counters: InstitutionalAuditCounters = Object.freeze({
      observations,
      suggestions,
      vetoes,
      cooldowns,
      interruptions
    });

    const finalVerdict = this.verdictFor(counters, decisions.length);
    const averageEvidenceScore =
      decisions.length === 0 ? 0 : this.round(evidenceSum / decisions.length);

    const complianceScore = this.clamp(
      100 -
        integrityPenalty -
        vetoes * 8 -
        cooldowns * 10 -
        interruptions * 18 -
        Math.max(0, highestRiskPressure - 70) * 0.35,
      0,
      100
    );

    return Object.freeze({
      auditId,
      sessionId,
      replayId,
      decisionsAudited: decisions.length,
      finalVerdict,
      complianceScore: this.round(complianceScore),
      averageEvidenceScore,
      highestRiskPressure: this.round(highestRiskPressure),
      hasBlockingDecision: vetoes > 0 || cooldowns > 0 || interruptions > 0,
      counters,
      findings: Object.freeze(findings),
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      auditTrail: this.auditTrailFor(counters, finalVerdict, complianceScore, highestRiskPressure, input.decisions.length)
    });
  }

  public evaluate(input: InstitutionalAuditInput): InstitutionalAuditReport {
    return this.audit(input);
  }

  public execute(input: InstitutionalAuditInput): InstitutionalAuditReport {
    return this.audit(input);
  }

  private verdictFor(counters: InstitutionalAuditCounters, decisionsAudited: number): InstitutionalAuditVerdict {
    if (decisionsAudited === 0) return 'NON_COMPLIANT';
    if (counters.interruptions > 0) return 'INTERRUPTED';
    if (counters.cooldowns > 0) return 'COOLDOWN';
    if (counters.vetoes > 0) return 'VETOED';
    if (counters.suggestions > 0) return 'ASSISTED';
    return 'OBSERVED';
  }

  private severityFor(
    type: InstitutionalAuditDecisionType,
    riskPressure: number
  ): 'INFO' | 'WARNING' | 'BLOCKING' | 'TERMINAL' {
    if (type === 'SESSION_INTERRUPTED') return 'TERMINAL';
    if (type === 'SUPERVISOR_VETO' || type === 'COOLDOWN_TRIGGERED') return 'BLOCKING';
    if (riskPressure >= 70) return 'WARNING';
    return 'INFO';
  }

  private auditTrailFor(
    counters: InstitutionalAuditCounters,
    finalVerdict: InstitutionalAuditVerdict,
    complianceScore: number,
    highestRiskPressure: number,
    originalDecisionCount: number
  ): readonly string[] {
    const trail: string[] = [
      `FINAL_VERDICT:${finalVerdict}`,
      `OBSERVATIONS:${counters.observations}`,
      `ASSISTED_SUGGESTIONS:${counters.suggestions}`,
      `SUPERVISOR_VETOES:${counters.vetoes}`,
      `COOLDOWNS:${counters.cooldowns}`,
      `INTERRUPTIONS:${counters.interruptions}`,
      `COMPLIANCE_SCORE:${this.round(complianceScore)}`,
      `HIGHEST_RISK_PRESSURE:${this.round(highestRiskPressure)}`
    ];

    if (originalDecisionCount > MAX_AUDIT_DECISIONS) {
      trail.push('AUDIT_TRUNCATED_TO_MEMORY_CAP');
    }

    trail.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    trail.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(trail);
  }

  private assertInput(input: InstitutionalAuditInput): void {
    if (!Array.isArray(input.decisions)) {
      throw new Error('INVALID_INSTITUTIONAL_AUDIT_DECISIONS');
    }
  }

  private assertDecision(decision: InstitutionalAuditDecision): void {
    if (typeof decision.decisionId !== 'string' || decision.decisionId.trim().length === 0) {
      throw new Error('INVALID_INSTITUTIONAL_AUDIT_DECISION_ID');
    }

    if (!Number.isFinite(decision.timestamp) || decision.timestamp < 0) {
      throw new Error('INVALID_INSTITUTIONAL_AUDIT_TIMESTAMP');
    }

    if (!this.isKnownDecisionType(decision.type)) {
      throw new Error('INVALID_INSTITUTIONAL_AUDIT_DECISION_TYPE');
    }

    if (typeof decision.reason !== 'string' || decision.reason.trim().length === 0) {
      throw new Error('INVALID_INSTITUTIONAL_AUDIT_REASON');
    }
  }

  private isKnownDecisionType(type: InstitutionalAuditDecisionType): boolean {
    switch (type) {
      case 'OBSERVATION_ONLY':
      case 'ASSISTED_SUGGESTION':
      case 'SUPERVISOR_VETO':
      case 'COOLDOWN_TRIGGERED':
      case 'SESSION_INTERRUPTED':
        return true;
    }
  }

  private resolveId(value: string | undefined, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  }

  private normalizeScore(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.round(this.clamp(value, 0, 100))
      : fallback;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
