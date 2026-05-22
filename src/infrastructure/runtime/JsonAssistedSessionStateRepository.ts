import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AssistedSessionStateRepositoryPort,
  OperatorRiskProfileSnapshot,
} from "../../application/session/RuntimeAssistedSessionWiring.js";

interface AssistedSessionPersistenceSnapshot {
  readonly version: 1;
  readonly activeProfile: OperatorRiskProfileSnapshot | null;
  readonly processedCommandIds: readonly string[];
  readonly updatedAtEpochMs: number;
}

/**
 * File-based repository for assisted runtime session recovery.
 *
 * Design goals:
 * - atomic writes using temp-file + rename;
 * - bounded memory through caller-provided command id set;
 * - strict validation on read;
 * - no silent corruption recovery.
 *
 * Complexity:
 * - load: O(k), where k is processedCommandIds length.
 * - save: O(k).
 * - memory: O(k).
 */
export class JsonAssistedSessionStateRepository implements AssistedSessionStateRepositoryPort {
  public constructor(private readonly filePath: string) {}

  public async loadProcessedCommandIds(): Promise<ReadonlySet<string>> {
    const snapshot = await this.loadSnapshot();
    return new Set<string>(snapshot.processedCommandIds);
  }

  public async saveProcessedCommandIds(commandIds: ReadonlySet<string>): Promise<void> {
    const snapshot = await this.loadSnapshot();

    await this.saveSnapshot({
      version: 1,
      activeProfile: snapshot.activeProfile,
      processedCommandIds: Array.from(commandIds),
      updatedAtEpochMs: Date.now(),
    });
  }

  public async saveActiveProfile(profile: OperatorRiskProfileSnapshot): Promise<void> {
    const snapshot = await this.loadSnapshot();

    await this.saveSnapshot({
      version: 1,
      activeProfile: profile,
      processedCommandIds: snapshot.processedCommandIds,
      updatedAtEpochMs: Date.now(),
    });
  }

  public async loadActiveProfile(): Promise<OperatorRiskProfileSnapshot | null> {
    const snapshot = await this.loadSnapshot();
    return snapshot.activeProfile;
  }

  private async loadSnapshot(): Promise<AssistedSessionPersistenceSnapshot> {
    let raw: string;

    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (this.isMissingFileError(error)) {
        return this.emptySnapshot();
      }

      throw error;
    }

    const parsed: unknown = JSON.parse(raw);
    return this.validateSnapshot(parsed);
  }

  private async saveSnapshot(snapshot: AssistedSessionPersistenceSnapshot): Promise<void> {
    const targetDir = dirname(this.filePath);
    const tempPath = `${this.filePath}.tmp`;

    await mkdir(targetDir, { recursive: true });

    await writeFile(
      tempPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );

    await rename(tempPath, this.filePath);
  }

  private emptySnapshot(): AssistedSessionPersistenceSnapshot {
    return {
      version: 1,
      activeProfile: null,
      processedCommandIds: [],
      updatedAtEpochMs: Date.now(),
    };
  }

  private validateSnapshot(value: unknown): AssistedSessionPersistenceSnapshot {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid assisted session snapshot: expected object.");
    }

    const record = value as Record<string, unknown>;

    if (record.version !== 1) {
      throw new Error("Invalid assisted session snapshot: unsupported version.");
    }

    if (!Array.isArray(record.processedCommandIds)) {
      throw new Error("Invalid assisted session snapshot: processedCommandIds must be an array.");
    }

    const processedCommandIds = record.processedCommandIds.map((item: unknown): string => {
      if (typeof item !== "string" || item.length === 0) {
        throw new Error("Invalid assisted session snapshot: command id must be a non-empty string.");
      }

      return item;
    });

    const activeProfile = this.validateProfile(record.activeProfile);

    if (typeof record.updatedAtEpochMs !== "number" || !Number.isFinite(record.updatedAtEpochMs)) {
      throw new Error("Invalid assisted session snapshot: updatedAtEpochMs must be finite.");
    }

    return {
      version: 1,
      activeProfile,
      processedCommandIds,
      updatedAtEpochMs: record.updatedAtEpochMs,
    };
  }

  private validateProfile(value: unknown): OperatorRiskProfileSnapshot | null {
    if (value === null) {
      return null;
    }

    if (typeof value !== "object") {
      throw new Error("Invalid assisted session snapshot: activeProfile must be object or null.");
    }

    const record = value as Record<string, unknown>;

    if (typeof record.profileId !== "string" || record.profileId.length === 0) {
      throw new Error("Invalid assisted session snapshot: profileId must be a non-empty string.");
    }

    if (typeof record.bankroll !== "number" || !Number.isFinite(record.bankroll)) {
      throw new Error("Invalid assisted session snapshot: bankroll must be finite.");
    }

    if (typeof record.stopLoss !== "number" || !Number.isFinite(record.stopLoss)) {
      throw new Error("Invalid assisted session snapshot: stopLoss must be finite.");
    }

    if (typeof record.targetProfit !== "number" || !Number.isFinite(record.targetProfit)) {
      throw new Error("Invalid assisted session snapshot: targetProfit must be finite.");
    }

    return {
      profileId: record.profileId,
      bankroll: record.bankroll,
      stopLoss: record.stopLoss,
      targetProfit: record.targetProfit,
    };
  }

  private isMissingFileError(error: unknown): boolean {
    return (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { readonly code?: unknown }).code === "ENOENT"
    );
  }
}
