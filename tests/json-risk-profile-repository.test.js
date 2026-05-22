const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  OperatorRiskProfileCalculator,
} = require('../dist/domain/risk');
const {
  JsonRiskProfileRepository,
} = require('../dist/infrastructure/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('JsonRiskProfileRepository saves and loads profile', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-risk-profile-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const saved = await repository.save(profile());
    const loaded = await repository.load();

    assert.equal(saved.accepted, true);
    assert.equal(loaded.found, true);
    assert.equal(loaded.profile.bankroll, 200);
    assert.equal(loaded.profile.riskMode, 'CONSERVATIVE');
    assert.match(await readFile(saved.path, 'utf8'), /riskMode/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonRiskProfileRepository returns not found instead of throwing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-risk-profile-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const loaded = await repository.load();

    assert.equal(loaded.found, false);
    assert.equal(loaded.profile, null);
    assert.match(loaded.reason, /not found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonRiskProfileRepository rejects corrupted JSON safely', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-risk-profile-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    await writeFile(repository.getPath(), '{invalid-json', 'utf8');

    const loaded = await repository.load();

    assert.equal(loaded.found, false);
    assert.equal(loaded.profile, null);
    assert.match(loaded.reason, /rejected/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonRiskProfileRepository supports explicit file path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-risk-profile-'));

  try {
    const file = join(dir, 'custom-risk.json');
    const repository = new JsonRiskProfileRepository(file);

    await repository.save(profile());

    assert.equal(repository.getPath(), file);
    assert.match(await readFile(file, 'utf8'), /CONSERVATIVE/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonRiskProfileRepository rejects invalid profile on save', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-risk-profile-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const invalid = { ...profile(), bankroll: 0 };

    await assert.rejects(() => repository.save(invalid), /bankroll/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
