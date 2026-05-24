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
 * Authorizes only supervised paper operation.
 *
 * This gate never authorizes real-money operation. It only decides whether
 * a paper session may proceed, requires active supervision, or must be blocked.
 *
 * Complexity:
 * - O(1), fixed rule set.
 * - Memory O(1).
 */
export class PaperRuntimeOperationalGate {
  public evaluate(input: PaperRuntimeOperationalGateInput): PaperRuntimeOperationalGateResult {
    const blockReasons: string[] = [];

    if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
      blockReasons.push("Endurance certification is not acceptable for paper operation.");
    }

    if (input.riskReadiness === "BLOCKED") {
      blockReasons.push("Risk readiness is blocked.");
    }

    if (input.sessionState === "FINISHED") {
      blockReasons.push("Session is already finished.");
    }

    if (input.sessionState === "IDLE") {
      blockReasons.push("Session is idle and must be prepared before paper operation.");
    }

    if (blockReasons.length > 0) {
      return {
        decision: "BLOCK_PAPER_OPERATION",
        allowed: false,
        reasons: blockReasons,
      };
    }

    const supervisionReasons: string[] = [];

    if (input.enduranceStatus === "WARNING") {
      supervisionReasons.push("Endurance certification has warnings.");
    }

    if (input.riskReadiness === "CAUTION") {
      supervisionReasons.push("Risk readiness requires caution.");
    }

    if (input.operatorMode === "UNSUPERVISED") {
      supervisionReasons.push("Paper operation requires active human supervision.");
    }

    if (supervisionReasons.length > 0) {
      return {
        decision: "REQUIRE_SUPERVISION",
        allowed: false,
        reasons: supervisionReasons,
      };
    }

    return {
      decision: "ALLOW_PAPER_OPERATION",
      allowed: true,
      reasons: ["Paper runtime operation is allowed under certified supervised conditions."],
    };
  }
}
