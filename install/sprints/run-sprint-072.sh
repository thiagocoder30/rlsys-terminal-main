#!/usr/bin/env bash
set -euo pipefail

SPRINT="sprint-072"
BRANCH="sprint-072-runtime-session-persistence"
COMMIT_MSG="feat(runtime): add assisted session persistence repository"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 072: Runtime Session Persistence =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/infrastructure/runtime
mkdir -p tests

cat > src/infrastructure/runtime/JsonAssistedSessionStateRepository.ts <<'TS'
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
TS

cat > tests/json-assisted-session-state-repository.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonAssistedSessionStateRepository } from "../dist/infrastructure/runtime/JsonAssistedSessionStateRepository.js";

async function createTempRepository() {
  const dir = await mkdtemp(join(tmpdir(), "rlsys-assisted-session-"));
  const filePath = join(dir, "assisted-session.json");

  return {
    dir,
    filePath,
    repository: new JsonAssistedSessionStateRepository(filePath),
  };
}

function createProfile() {
  return {
    profileId: "operator-default",
    bankroll: 1000,
    stopLoss: 120,
    targetProfit: 180,
  };
}

test("returns empty command id set when snapshot does not exist", async () => {
  const { dir, repository } = await createTempRepository();

  try {
    const commandIds = await repository.loadProcessedCommandIds();
    assert.equal(commandIds.size, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("persists and reloads processed command ids", async () => {
  const { dir, repository } = await createTempRepository();

  try {
    await repository.saveProcessedCommandIds(new Set(["cmd-1", "cmd-2"]));

    const commandIds = await repository.loadProcessedCommandIds();

    assert.equal(commandIds.has("cmd-1"), true);
    assert.equal(commandIds.has("cmd-2"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("persists and reloads active profile", async () => {
  const { dir, repository } = await createTempRepository();

  try {
    await repository.saveActiveProfile(createProfile());

    const profile = await repository.loadActiveProfile();

    assert.equal(profile.profileId, "operator-default");
    assert.equal(profile.bankroll, 1000);
    assert.equal(profile.stopLoss, 120);
    assert.equal(profile.targetProfit, 180);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preserves command ids when saving active profile", async () => {
  const { dir, repository } = await createTempRepository();

  try {
    await repository.saveProcessedCommandIds(new Set(["cmd-before-profile"]));
    await repository.saveActiveProfile(createProfile());

    const commandIds = await repository.loadProcessedCommandIds();

    assert.equal(commandIds.has("cmd-before-profile"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects corrupted snapshot instead of failing silently", async () => {
  const { dir, filePath, repository } = await createTempRepository();

  try {
    await writeFile(filePath, JSON.stringify({ version: 999 }), "utf8");

    await assert.rejects(
      () => repository.loadProcessedCommandIds(),
      /unsupported version/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writes valid json snapshot to disk", async () => {
  const { dir, filePath, repository } = await createTempRepository();

  try {
    await repository.saveActiveProfile(createProfile());

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    assert.equal(parsed.version, 1);
    assert.equal(parsed.activeProfile.profileId, "operator-default");
    assert.equal(Array.isArray(parsed.processedCommandIds), true);
    assert.equal(typeof parsed.updatedAtEpochMs, "number");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
JS

npm run build
npm test

git add \
  src/infrastructure/runtime/JsonAssistedSessionStateRepository.ts \
  tests/json-assisted-session-state-repository.test.js \
  install/sprints/run-sprint-072.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 072 runtime session persistence"
git push origin main

echo "== Sprint 072 completed, merged and pushed successfully =="
