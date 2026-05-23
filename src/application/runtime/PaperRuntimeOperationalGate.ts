export type PaperRuntimeEnduranceStatus =
  | "CERTIFIED"
  | "WARNING"
  | "FAILED"
  | "NO_DATA";

export type PaperRuntimeRiskReadiness =
  | "READY"
  | "CAUTION"
  | "BLOCKED";

export type PaperRuntimeSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export type PaperRuntimeOperatorMode =
  | "SUPERVISED"
  | "UNSUPERVISED";

export type PaperRuntimeGateDecision =
  | "ALLOW_PAPER_OPERATION"
  | "REQUIRE_SUPERVISION"
  | "BLOCK_PAPER_OPERATION";

export interface PaperRuntimeOperationalGateInput {
  readonly enduranceStatus: PaperRuntimeEnduranceStatus;
  readonly riskReadiness: PaperRuntimeRiskReadiness;
  readonly sessionState: PaperRuntimeSessionState;
  readonly operatorMode: PaperRuntimeOperatorMode;
}

export interface PaperRuntimeOperationalGateResult {
  readonly decision: PaperRuntimeGateDecision;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Determines whether paper runtime operation can proceed.
 *
 * This gate intentionally does not decide real-money permission. It only
 * authorizes paper operation under supervision after endurance and risk checks.
 *
 * Complexity:
 * - O(1), fixed rule set.
 * - Memory O(1).
 */
export class PaperRuntimeOperationalGate {
  public evaluate(input: PaperRuntimeOperationalGateInput): PaperRuntimeOperationalGateResult {
    const reasons: string[] = [];

    if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
      reasons.push("Endurance certification is not acceptable for paper operation.");
    }

    if (input.riskReadiness === "BLOCKED") {
      reasons.push("Risk readiness is blocked.");
    }

    if (input.sessionState === "FINISHED") {
      reasons.push("Session is already finished.");
    }

    if (input.sessionState === "IDLE") {
      reasons.push("Session is idle and must be prepared before paper operation.");
    }

    if (reasons.length > 0) {
      return {
        decision: "BLOCK_PAPER_OPERATION",
        allowed: false,
        reasons,
      };
    }

    if (
      input.enduranceStatus === "WARNING"
      || input.riskReadiness === "CAUTION"
      || input.operatorMode === "UNSUPERVISED"
      || input.sessionState === "PAUSED"
    ) {
      return {
        decision: "REQUIRE_SUPERVISION",
        allowed: false,
        reasons: ["Paper operation requires active human supervision."],
      };
    }

    return {
      decision: "ALLOW_PAPER_OPERATION",
      allowed: true,
      reasons: ["Paper runtime operation is allowed under certified supervised conditions."],
    };
  }
}
