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
