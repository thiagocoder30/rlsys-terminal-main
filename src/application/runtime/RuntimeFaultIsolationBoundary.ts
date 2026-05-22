export type RuntimeIsolationZone =
  | "CRITICAL"
  | "IMPORTANT"
  | "NON_CRITICAL";

export type RuntimeFaultIsolationStatus =
  | "EXECUTED"
  | "DEGRADED"
  | "CIRCUIT_OPEN";

export interface RuntimeFaultIsolationResult<TValue> {
  readonly status: RuntimeFaultIsolationStatus;
  readonly zone: RuntimeIsolationZone;
  readonly value?: TValue;
  readonly errorMessage?: string;
  readonly failureCount: number;
}

export interface RuntimeFaultIsolationPolicy {
  readonly zone: RuntimeIsolationZone;
  readonly maxFailuresBeforeOpen: number;
  readonly recoverable: boolean;
}

interface RuntimeFaultZoneState {
  failureCount: number;
  circuitOpen: boolean;
}

/**
 * Protects runtime execution zones from cascading failures.
 *
 * CRITICAL zones rethrow after recording the fault.
 * IMPORTANT and NON_CRITICAL zones degrade gracefully.
 *
 * Complexity:
 * - O(1) execution bookkeeping.
 * - Memory O(z), where z is the number of named zones.
 */
export class RuntimeFaultIsolationBoundary {
  private readonly states: Map<string, RuntimeFaultZoneState> = new Map<string, RuntimeFaultZoneState>();

  public async execute<TValue>(
    zoneId: string,
    policy: RuntimeFaultIsolationPolicy,
    operation: () => Promise<TValue>,
  ): Promise<RuntimeFaultIsolationResult<TValue>> {
    this.validate(zoneId, policy);

    const state = this.getState(zoneId);

    if (state.circuitOpen) {
      return {
        status: "CIRCUIT_OPEN",
        zone: policy.zone,
        errorMessage: `Circuit is open for runtime zone: ${zoneId}.`,
        failureCount: state.failureCount,
      };
    }

    try {
      const value = await operation();

      state.failureCount = 0;
      state.circuitOpen = false;

      return {
        status: "EXECUTED",
        zone: policy.zone,
        value,
        failureCount: 0,
      };
    } catch (error: unknown) {
      state.failureCount += 1;

      if (state.failureCount >= policy.maxFailuresBeforeOpen) {
        state.circuitOpen = true;
      }

      const errorMessage = this.describeError(error);

      if (policy.zone === "CRITICAL" || policy.recoverable === false) {
        throw new Error(`Critical runtime zone failed: ${zoneId}: ${errorMessage}`);
      }

      return {
        status: "DEGRADED",
        zone: policy.zone,
        errorMessage,
        failureCount: state.failureCount,
      };
    }
  }

  public reset(zoneId: string): void {
    this.states.delete(zoneId);
  }

  public getFailureCount(zoneId: string): number {
    return this.getState(zoneId).failureCount;
  }

  public isCircuitOpen(zoneId: string): boolean {
    return this.getState(zoneId).circuitOpen;
  }

  private getState(zoneId: string): RuntimeFaultZoneState {
    const existing = this.states.get(zoneId);

    if (existing !== undefined) {
      return existing;
    }

    const created: RuntimeFaultZoneState = {
      failureCount: 0,
      circuitOpen: false,
    };

    this.states.set(zoneId, created);
    return created;
  }

  private validate(zoneId: string, policy: RuntimeFaultIsolationPolicy): void {
    if (zoneId.trim().length === 0) {
      throw new Error("Runtime fault isolation zoneId cannot be empty.");
    }

    if (!Number.isInteger(policy.maxFailuresBeforeOpen) || policy.maxFailuresBeforeOpen <= 0) {
      throw new Error("Runtime fault isolation maxFailuresBeforeOpen must be a positive integer.");
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "Unknown runtime fault.";
  }
}
