'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  OperatorGuidedHud,
} = require('../../../dist/application/runtime/OperatorGuidedHud.js');

const {
  PaperTestOperatorConsole,
} = require('../../../dist/application/runtime/PaperTestOperatorConsole.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempConsole() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-guided-hud-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const consoleEngine = new PaperTestOperatorConsole({
    repository,
    dataDir: dir,
    repeatSessionId: 'PAPER_TEST_001',
  });

  return { dir, ledgerFile, consoleEngine };
}

function warmupPayload(size = 200) {
  return Array.from({ length: size }, (_, index) => (index % 2 === 0 ? 'P' : 'V')).join(',');
}

test('operator guided HUD renders initial Portuguese guidance', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const hud = new OperatorGuidedHud();
    const view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.status, 'HUD_GUIDED_READY');
    assert.equal(view.faseAtual, 'INICIALIZACAO');
    assert.match(view.texto, /HUD GUIADA DO OPERADOR/);
    assert.match(view.texto, /Fase Atual: INICIALIZAÇÃO/);
    assert.match(view.texto, /Próxima Ação/);
    assert.match(view.texto, /Digite: start/);
    assert.match(view.texto, /Dinheiro Real:\nBLOQUEADO/);
    assert.match(view.texto, /Execução Automática:\nBLOQUEADA/);
    assert.match(view.texto, /LiveMoneyAuthorization=false/);
    assert.match(view.texto, /AutomaticBetExecutionAllowed=false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operator guided HUD advances through warmup and qualification phases', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const hud = new OperatorGuidedHud();

    await consoleEngine.execute('start', 1760000010000);
    let view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'WARMUP');
    assert.match(view.texto, /warmup-file/);

    await consoleEngine.execute(`warmup-paste ${warmupPayload()}`, 1760000010000);
    view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'QUALIFICACAO');
    assert.match(view.texto, /Digite: qualify/);

    await consoleEngine.execute('qualify', 1760000010000);
    view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'OBSERVACAO');
    assert.match(view.texto, /round <valor>/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operator guided HUD shows registration phase after pending confirm', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const hud = new OperatorGuidedHud();

    await consoleEngine.execute('start', 1760000010000);
    await consoleEngine.execute(`warmup-paste ${warmupPayload()}`, 1760000010000);
    await consoleEngine.execute('qualify', 1760000010000);
    await consoleEngine.execute('round P', 1760000010000);
    await consoleEngine.execute('confirm', 1760000010000);

    const view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'REGISTRO');
    assert.match(view.texto, /Digite: win, loss ou skip/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operator guided HUD shows certification and completed phases', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const hud = new OperatorGuidedHud();

    await consoleEngine.execute('start', 1760000010000);
    await consoleEngine.execute(`warmup-paste ${warmupPayload()}`, 1760000010000);
    await consoleEngine.execute('qualify', 1760000010000);
    await consoleEngine.execute('finish', 1760000010000);

    let view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'CERTIFICACAO');
    assert.equal(view.status, 'HUD_GUIDED_NEEDS_REVIEW');
    assert.match(view.texto, /Digite: certify/);

    await consoleEngine.execute('certify', 1760000010000);
    view = hud.renderFromState(consoleEngine.snapshot());

    assert.equal(view.faseAtual, 'CONCLUIDO');
    assert.match(view.texto, /Digite: exit/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operator guided HUD renders command result in Portuguese', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const hud = new OperatorGuidedHud();
    const result = await consoleEngine.execute('help', 1760000010000);

    assert.equal(result.ok, true);

    const view = hud.renderAfterCommand(result);

    assert.match(view.texto, /RESULTADO DO COMANDO/);
    assert.match(view.texto, /Comando Executado: help/);
    assert.match(view.texto, /Próxima Ação Recomendada/);
    assert.match(view.texto, /Governança/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operator guided HUD CLI starts and exits with Portuguese output', async () => {
  const { dir, ledgerFile } = await tempConsole();

  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/paper-test-operator-console-guided.js',
        '--ledgerFile', ledgerFile,
        '--repeatSessionId', 'PAPER_TEST_001',
      ],
      {
        cwd: process.cwd(),
        input: 'status\nexit\n',
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /HUD GUIADA DO OPERADOR/);
    assert.match(result.stdout, /Próxima Ação/);
    assert.match(result.stdout, /Dinheiro Real:\nBLOQUEADO/);
    assert.match(result.stdout, /HUD guiada encerrada/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
