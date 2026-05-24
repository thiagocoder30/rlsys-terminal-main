import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  PaperRuntimeSessionSnapshot,
  PaperRuntimeSessionSnapshotRepository,
} from "../../application/runtime/PaperRuntimeSessionSnapshot.js";

/**
 * JSON-backed snapshot repository for paper runtime sessions.
 *
 * Complexity:
 * - save: O(1) with bounded snapshot payload.
 * - load: O(1) with bounded snapshot payload.
 */
export class JsonPaperRuntimeSessionSnapshotRepository implements PaperRuntimeSessionSnapshotRepository {
  public constructor(
    private readonly filePath: string,
  ) {}

  public save(snapshot: PaperRuntimeSessionSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  public load(): PaperRuntimeSessionSnapshot | null {
    if (!existsSync(this.filePath)) {
      return null;
    }

    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    return this.validate(parsed);
  }

  private validate(value: unknown): PaperRuntimeSessionSnapshot {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid paper runtime snapshot: expected object.");
    }

    const record = value as Record<string, unknown>;

    if (record.schemaVersion !== 1) {
      throw new Error("Invalid paper runtime snapshot: unsupported schemaVersion.");
    }

    if (typeof record.savedAtEpochMs !== "number" || !Number.isFinite(record.savedAtEpochMs)) {
      throw new Error("Invalid paper runtime snapshot: savedAtEpochMs must be finite.");
    }

    if (
      record.sessionState !== "IDLE"
      && record.sessionState !== "READY"
      && record.sessionState !== "RUNNING"
      && record.sessionState !== "PAUSED"
      && record.sessionState !== "FINISHED"
    ) {
      throw new Error("Invalid paper runtime snapshot: sessionState is invalid.");
    }

    if (typeof record.iteration !== "number" || !Number.isInteger(record.iteration) || record.iteration < 0) {
      throw new Error("Invalid paper runtime snapshot: iteration must be a non-negative integer.");
    }

    if (typeof record.gracefulShutdown !== "boolean") {
      throw new Error("Invalid paper runtime snapshot: gracefulShutdown must be boolean.");
    }

    if (record.lastCommand !== undefined && typeof record.lastCommand !== "string") {
      throw new Error("Invalid paper runtime snapshot: lastCommand must be string when present.");
    }

    return record as unknown as PaperRuntimeSessionSnapshot;
  }
}
