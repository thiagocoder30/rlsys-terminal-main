export type PaperRuntimeV1CertificationStatus =
  | "CERTIFIED"
  | "FAILED";

export interface PaperRuntimeV1CertificationInput {
  readonly hasInteractiveLoop: boolean;
  readonly hasOperationalGate: boolean;
  readonly hasSessionSupervisor: boolean;
  readonly hasHudComposer: boolean;
  readonly hasReplAdapter: boolean;
  readonly allowsPrepareWithoutOperationGateConfusion: boolean;
}

export interface PaperRuntimeV1CertificationResult {
  readonly status: PaperRuntimeV1CertificationStatus;
  readonly certified: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Certifies the minimal paper runtime v1.0 operational surface.
 *
 * This is not a gambling-performance certificate. It only certifies that
 * the defensive paper runtime shell has the required governance components.
 *
 * Complexity:
 * - O(1), fixed checklist.
 * - Memory O(1).
 */
export class PaperRuntimeV1Certification {
  public certify(input: PaperRuntimeV1CertificationInput): PaperRuntimeV1CertificationResult {
    const failures: string[] = [];

    if (!input.hasInteractiveLoop) {
      failures.push("Interactive loop is missing.");
    }

    if (!input.hasOperationalGate) {
      failures.push("Operational gate is missing.");
    }

    if (!input.hasSessionSupervisor) {
      failures.push("Session supervisor is missing.");
    }

    if (!input.hasHudComposer) {
      failures.push("HUD composer is missing.");
    }

    if (!input.hasReplAdapter) {
      failures.push("REPL adapter is missing.");
    }

    if (!input.allowsPrepareWithoutOperationGateConfusion) {
      failures.push("PREPARE command still exposes operation gate confusion.");
    }

    if (failures.length > 0) {
      return {
        status: "FAILED",
        certified: false,
        score: Math.max(0, 100 - failures.length * 20),
        reasons: failures,
      };
    }

    return {
      status: "CERTIFIED",
      certified: true,
      score: 100,
      reasons: ["Paper Runtime v1.0 defensive shell is certified."],
    };
  }
}
