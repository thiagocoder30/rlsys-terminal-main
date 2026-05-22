import type {
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  RuntimeRecoveryResult,
} from "./RuntimeRecoveryService.js";

export interface RuntimeRecoveryInspectorPort {
  inspect(): Promise<RuntimeRecoveryResult>;
}

export interface AssistedRuntimeBootPort {
  boot(): Promise<AssistedSessionResult>;
}

export type RuntimeRecoveryBootStatus =
  | "BOOTED_CLEAN"
  | "BOOTED_RECOVERED"
  | "BOOT_BLOCKED";

export interface RuntimeRecoveryBootResult {
  readonly status: RuntimeRecoveryBootStatus;
  readonly booted: boolean;
  readonly message: string;
  readonly recovery: RuntimeRecoveryResult;
  readonly assistedResult?: AssistedSessionResult;
}

/**
 * Coordinates recovery inspection before assisted runtime boot.
 *
 * This service prevents the runtime from starting over corrupted persisted state.
 *
 * Complexity:
 * - O(k), delegated to recovery inspection.
 * - O(1) orchestration overhead.
 * - Memory bounded by the recovery snapshot size.
 */
export class RuntimeRecoveryBootCoordinator {
  public constructor(
    private readonly recoveryInspector: RuntimeRecoveryInspectorPort,
    private readonly assistedRuntime: AssistedRuntimeBootPort,
  ) {}

  public async boot(): Promise<RuntimeRecoveryBootResult> {
    const recovery = await this.recoveryInspector.inspect();

    if (recovery.status === "CORRUPTED_SNAPSHOT") {
      return {
        status: "BOOT_BLOCKED",
        booted: false,
        message: "Runtime boot blocked because assisted session snapshot is corrupted.",
        recovery,
      };
    }

    const assistedResult = await this.assistedRuntime.boot();

    if (recovery.status === "RECOVERABLE_SESSION") {
      return {
        status: "BOOTED_RECOVERED",
        booted: true,
        message: "Runtime booted with recoverable assisted session state.",
        recovery,
        assistedResult,
      };
    }

    return {
      status: "BOOTED_CLEAN",
      booted: true,
      message: "Runtime booted with a clean assisted session state.",
      recovery,
      assistedResult,
    };
  }
}
