import type {
  PaperRuntimeOperationalGate,
  PaperRuntimeOperationalGateInput,
  PaperRuntimeOperationalGateResult,
} from "./PaperRuntimeOperationalGate.js";

export type PaperRuntimeCommandIntent =
  | "PREPARE"
  | "START"
  | "PAUSE"
  | "RESUME"
  | "FINISH"
  | "STATUS";

export type PaperRuntimeSupervisorDecision =
  | "SESSION_PREPARED"
  | "SESSION_STARTED"
  | "SESSION_PAUSED"
  | "SESSION_RESUMED"
  | "SESSION_FINISHED"
  | "STATUS_REPORTED"
  | "COMMAND_BLOCKED"
  | "SUPERVISION_REQUIRED";

export interface PaperRuntimeSupervisorInput extends PaperRuntimeOperationalGateInput {
  readonly commandIntent: PaperRuntimeCommandIntent;
}

export interface PaperRuntimeSupervisorResult {
  readonly decision: PaperRuntimeSupervisorDecision;
  readonly allowed: boolean;
  readonly nextSessionState: PaperRuntimeOperationalGateInput["sessionState"];
  readonly gate: PaperRuntimeOperationalGateResult;
  readonly messages: readonly string[];
}

/**
 * Supervises paper runtime command flow using the operational gate.
 *
 * It does not execute financial operations. It only transitions paper session
 * governance state and blocks unsafe command intents.
 *
 * Complexity:
 * - O(1), fixed transition table.
 * - Memory O(1).
 */
export class PaperRuntimeSessionSupervisor {
  public constructor(
    private readonly gate: PaperRuntimeOperationalGate,
  ) {}

  public supervise(input: PaperRuntimeSupervisorInput): PaperRuntimeSupervisorResult {
    const gateResult = this.gate.evaluate(input);

    if (input.commandIntent === "STATUS") {
      return {
        decision: "STATUS_REPORTED",
        allowed: true,
        nextSessionState: input.sessionState,
        gate: gateResult,
        messages: gateResult.reasons,
      };
    }

    if (input.commandIntent === "PREPARE") {
      if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
        return this.block(input, gateResult, "Cannot prepare paper session without acceptable endurance certification.");
      }

      return {
        decision: "SESSION_PREPARED",
        allowed: true,
        nextSessionState: "READY",
        gate: gateResult,
        messages: ["Paper session prepared for supervised operation."],
      };
    }

    if (input.commandIntent === "FINISH") {
      return {
        decision: "SESSION_FINISHED",
        allowed: true,
        nextSessionState: "FINISHED",
        gate: gateResult,
        messages: ["Paper session finished."],
      };
    }

    if (input.commandIntent === "PAUSE") {
      if (input.sessionState !== "RUNNING") {
        return this.block(input, gateResult, "Only running paper sessions can be paused.");
      }

      return {
        decision: "SESSION_PAUSED",
        allowed: true,
        nextSessionState: "PAUSED",
        gate: gateResult,
        messages: ["Paper session paused."],
      };
    }

    if (input.commandIntent === "START" || input.commandIntent === "RESUME") {
      if (gateResult.decision === "BLOCK_PAPER_OPERATION") {
        return this.block(input, gateResult, "Paper operation is blocked by operational gate.");
      }

      if (gateResult.decision === "REQUIRE_SUPERVISION") {
        return {
          decision: "SUPERVISION_REQUIRED",
          allowed: false,
          nextSessionState: input.sessionState,
          gate: gateResult,
          messages: gateResult.reasons,
        };
      }

      return {
        decision: input.commandIntent === "START" ? "SESSION_STARTED" : "SESSION_RESUMED",
        allowed: true,
        nextSessionState: "RUNNING",
        gate: gateResult,
        messages: ["Paper runtime session is supervised and operational."],
      };
    }

    return this.block(input, gateResult, "Unsupported paper runtime command intent.");
  }

  private block(
    input: PaperRuntimeSupervisorInput,
    gate: PaperRuntimeOperationalGateResult,
    message: string,
  ): PaperRuntimeSupervisorResult {
    return {
      decision: "COMMAND_BLOCKED",
      allowed: false,
      nextSessionState: input.sessionState,
      gate,
      messages: [message, ...gate.reasons],
    };
  }
}
