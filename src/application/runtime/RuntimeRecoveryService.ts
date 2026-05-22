import type {
  AssistedSessionStateRepositoryPort,
  OperatorRiskProfileSnapshot,
} from "../session/RuntimeAssistedSessionWiring.js";

export type RuntimeRecoveryStatus =
  | "CLEAN_START"
  | "RECOVERABLE_SESSION"
  | "CORRUPTED_SNAPSHOT";

export interface RuntimeRecoveryResult {
  readonly status: RuntimeRecoveryStatus;
  readonly canRecover: boolean;
  readonly message: string;
  readonly activeProfile: OperatorRiskProfileSnapshot | null;
  readonly processedCommandCount: number;
}

export interface RuntimeRecoveryStateRepositoryPort extends AssistedSessionStateRepositoryPort {
  loadActiveProfile(): Promise<OperatorRiskProfileSnapshot | null>;
}

/**
 * Inspects persisted assisted-session state and decides how the runtime should start.
 *
 * This service does not mutate state. It only classifies recovery conditions.
 *
 * Complexity:
 * - O(k), where k is the processed command id count.
 * - Memory O(k), inherited from repository read.
 */
export class RuntimeRecoveryService {
  public constructor(
    private readonly stateRepository: RuntimeRecoveryStateRepositoryPort,
  ) {}

  public async inspect(): Promise<RuntimeRecoveryResult> {
    try {
      const activeProfile = await this.stateRepository.loadActiveProfile();
      const processedCommandIds = await this.stateRepository.loadProcessedCommandIds();

      if (activeProfile === null && processedCommandIds.size === 0) {
        return {
          status: "CLEAN_START",
          canRecover: false,
          message: "No assisted runtime session snapshot was found. Runtime can start cleanly.",
          activeProfile: null,
          processedCommandCount: 0,
        };
      }

      if (activeProfile === null && processedCommandIds.size > 0) {
        return {
          status: "CORRUPTED_SNAPSHOT",
          canRecover: false,
          message: "Processed commands exist without an active profile. Manual inspection is required.",
          activeProfile: null,
          processedCommandCount: processedCommandIds.size,
        };
      }

      return {
        status: "RECOVERABLE_SESSION",
        canRecover: true,
        message: "A previous assisted runtime session can be recovered safely.",
        activeProfile,
        processedCommandCount: processedCommandIds.size,
      };
    } catch (error: unknown) {
      return {
        status: "CORRUPTED_SNAPSHOT",
        canRecover: false,
        message: this.describeError(error),
        activeProfile: null,
        processedCommandCount: 0,
      };
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return `Assisted runtime recovery snapshot is invalid: ${error.message}`;
    }

    return "Assisted runtime recovery snapshot is invalid due to an unknown error.";
  }
}
