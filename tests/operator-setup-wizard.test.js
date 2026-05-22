const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { OperatorSetupWizard } = require('../dist/application/setup');
const { JsonRiskProfileRepository } = require('../dist/infrastructure/risk');

test('OperatorSetupWizard creates and persists conservative risk profile', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-setup-wizard-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const wizard = new OperatorSetupWizard(repository);

    const result = await wizard.configure({
      bankroll: 200,
      riskMode: 'CONSERVATIVE',
      allowMartingale: true,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.profile.baseStake, 2);
    assert.equal(result.profile.dailyStopWin, 16);
    assert.equal(result.profile.dailyStopLoss, 10);
    assert.match(result.message, /Perfil de risco/);

    const raw = await readFile(repository.getPath(), 'utf8');
    assert.match(raw, /CONSERVATIVE/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('OperatorSetupWizard disables martingale when requested', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-setup-wizard-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const wizard = new OperatorSetupWizard(repository);

    const result = await wizard.configure({
      bankroll: 150,
      riskMode: 'MODERATE',
      allowMartingale: false,
    });

    assert.equal(result.profile.maxMartingaleSteps, 0);
    assert.match(result.message, /Martingale máximo: 0/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('OperatorSetupWizard rejects invalid bankroll', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-setup-wizard-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const wizard = new OperatorSetupWizard(repository);

    await assert.rejects(() => wizard.configure({
      bankroll: 0,
      riskMode: 'CONSERVATIVE',
      allowMartingale: true,
    }), /bankroll/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('OperatorSetupWizard rejects invalid risk mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-setup-wizard-'));

  try {
    const repository = new JsonRiskProfileRepository(dir);
    const wizard = new OperatorSetupWizard(repository);

    await assert.rejects(() => wizard.configure({
      bankroll: 100,
      riskMode: 'INVALID',
      allowMartingale: true,
    }), /riskMode/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
