export type AssistedSessionCommandType =
  | "PROFILE_LOADED"
  | "START"
  | "WIN"
  | "LOSS"
  | "PAUSE"
  | "RESUME"
  | "REPORT"
  | "FINISH"
  | "RESET";

export interface AssistedSessionCommand {
  readonly id: string;
  readonly type: AssistedSessionCommandType;
  readonly amount?: number;
  readonly occurredAtEpochMs: number;
}

export interface AssistedSessionResult {
  readonly accepted: boolean;
  readonly status: string;
  readonly message: string;
  readonly hud?: string;
  readonly report?: string;
}

export interface OperatorRiskProfileSnapshot {
  readonly profileId: string;
  readonly bankroll: number;
  readonly stopLoss: number;
  readonly targetProfit: number;
}

export interface RiskProfileLoaderPort {
  load(): Promise<OperatorRiskProfileSnapshot | null>;
}

export interface OperatorSetupWizardPort {
  run(): Promise<OperatorRiskProfileSnapshot>;
}

export interface GuidedModeCoordinatorPort {
  dispatch(command: AssistedSessionCommand): Promise<AssistedSessionResult>;
}

export interface PaperLedgerRuntimePort {
  recordWin(amount: number): Promise<void>;
  recordLoss(amount: number): Promise<void>;
}

export interface BankrollHudComposerPort {
  compose(profile: OperatorRiskProfileSnapshot): Promise<string>;
}

export interface HumanSessionReportComposerPort {
  compose(): Promise<string>;
}

export interface AssistedSessionStateRepositoryPort {
  loadProcessedCommandIds(): Promise<ReadonlySet<string>>;
  saveProcessedCommandIds(commandIds: ReadonlySet<string>): Promise<void>;
  saveActiveProfile(profile: OperatorRiskProfileSnapshot): Promise<void>;
}

/**
 * Application service that wires the assisted runtime session flow.
 *
 * It does not own business rules. It only orchestrates existing ports:
 * profile loading, guided coordinator, paper ledger, HUD and human report.
 *
 * Complexity:
 * - boot: O(k), where k is the number of persisted idempotency keys.
 * - handle: O(1) in the common path.
 * - memory: bounded by maxIdempotencyKeys.
 */
export class RuntimeAssistedSessionWiring {
  private readonly maxIdempotencyKeys: number;
  private processedCommandIds: Set<string> = new Set<string>();
  private activeProfile: OperatorRiskProfileSnapshot | null = null;

  public constructor(
    private readonly dependencies: {
      readonly riskProfileLoader: RiskProfileLoaderPort;
      readonly setupWizard: OperatorSetupWizardPort;
      readonly coordinator: GuidedModeCoordinatorPort;
      readonly ledger: PaperLedgerRuntimePort;
      readonly hudComposer: BankrollHudComposerPort;
      readonly reportComposer: HumanSessionReportComposerPort;
      readonly stateRepository: AssistedSessionStateRepositoryPort;
      readonly maxIdempotencyKeys?: number;
    },
  ) {
    this.maxIdempotencyKeys = dependencies.maxIdempotencyKeys ?? 512;
  }

  public async boot(): Promise<AssistedSessionResult> {
    this.processedCommandIds = new Set<string>(
      await this.dependencies.stateRepository.loadProcessedCommandIds(),
    );

    const loadedProfile = await this.dependencies.riskProfileLoader.load();
    const profile = loadedProfile ?? await this.dependencies.setupWizard.run();

    this.activeProfile = profile;
    await this.dependencies.stateRepository.saveActiveProfile(profile);

    return this.dependencies.coordinator.dispatch({
      id: `profile-loaded-${profile.profileId}`,
      type: "PROFILE_LOADED",
      occurredAtEpochMs: Date.now(),
    });
  }

  public async handle(command: AssistedSessionCommand): Promise<AssistedSessionResult> {
    if (this.processedCommandIds.has(command.id)) {
      return {
        accepted: true,
        status: "IDEMPOTENT_REPLAY",
        message: "Command already processed safely.",
      };
    }

    if (this.activeProfile === null && command.type !== "RESET") {
      return {
        accepted: false,
        status: "PROFILE_NOT_LOADED",
        message: "A loaded risk profile is required before operational commands.",
      };
    }

    await this.applyFinancialSideEffect(command);

    const coordinatorResult = await this.dependencies.coordinator.dispatch(command);

    const hud = this.activeProfile === null
      ? undefined
      : await this.dependencies.hudComposer.compose(this.activeProfile);

    const report = command.type === "REPORT" || command.type === "FINISH"
      ? await this.dependencies.reportComposer.compose()
      : undefined;

    await this.markProcessed(command.id);

    if (command.type === "RESET") {
      this.activeProfile = null;
    }

    return {
      accepted: coordinatorResult.accepted,
      status: coordinatorResult.status,
      message: coordinatorResult.message,
      hud,
      report,
    };
  }

  private async applyFinancialSideEffect(command: AssistedSessionCommand): Promise<void> {
    if (command.type !== "WIN" && command.type !== "LOSS") {
      return;
    }

    const amount = command.amount;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid ${command.type} amount. Expected a positive finite number.`);
    }

    if (command.type === "WIN") {
      await this.dependencies.ledger.recordWin(amount);
      return;
    }

    await this.dependencies.ledger.recordLoss(amount);
  }

  private async markProcessed(commandId: string): Promise<void> {
    this.processedCommandIds.add(commandId);

    if (this.processedCommandIds.size > this.maxIdempotencyKeys) {
      const compacted = Array.from(this.processedCommandIds).slice(
        this.processedCommandIds.size - this.maxIdempotencyKeys,
      );
      this.processedCommandIds = new Set<string>(compacted);
    }

    await this.dependencies.stateRepository.saveProcessedCommandIds(this.processedCommandIds);
  }
}
