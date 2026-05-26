'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const {
  handleOperatorDisciplineCommand,
} = require('./paper-runtime-operator-discipline-preload');
const {
  handlePaperRuntimeLedgerCommand,
} = require('./paper-runtime-ledger-command-preload');

const {
  PaperRuntimeOperationalGate,
} = require('../dist/application/runtime/PaperRuntimeOperationalGate.js');
const {
  PaperRuntimeSessionSupervisor,
} = require('../dist/application/runtime/PaperRuntimeSessionSupervisor.js');
const {
  PaperRuntimeHudGateComposer,
} = require('../dist/application/runtime/PaperRuntimeHudGateComposer.js');
const {
  PaperRuntimeReplCommandAdapter,
} = require('../dist/application/runtime/PaperRuntimeReplCommandAdapter.js');
const {
  PaperRuntimeInteractiveLoop,
} = require('../dist/application/runtime/PaperRuntimeInteractiveLoop.js');
const {
  PaperRuntimeSessionSnapshotFactory,
} = require('../dist/application/runtime/PaperRuntimeSessionSnapshot.js');
const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require('../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js');

function resolveSnapshotPath() {
  return (
    process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SESSION_SNAPSHOT_PATH ||
    path.join('data', 'paper-runtime', 'session-snapshot.json')
  );
}

function createLoop() {
  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
      new PaperRuntimeHudGateComposer(),
    ),
  );
}

function printHelp() {
  console.log([
    'RL.SYS PAPER RUNTIME SESSION',
    '',
    'Commands:',
    '  prepare',
    '  start',
    '  status',
    '  pause',
    '  resume',
    '  finish',
    '  win <amount>',
    '  loss <amount>',
    '  ledger',
    '  bankroll',
    '  exit',
    '',
  ].join('\n'));
}

function runStartupRecovery() {
  try {
    const {
      runPaperRuntimeSnapshotRecovery,
    } = require('./paper-runtime-snapshot-recovery');

    return runPaperRuntimeSnapshotRecovery();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`RL.SYS paper runtime recovery bootstrap skipped: ${message}`);
    return null;
  }
}

function saveSnapshot(loop, gracefulShutdown) {
  const state = loop.currentState();
  const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
    sessionState: state.sessionState,
    iteration: state.iteration,
    lastCommand: state.lastCommand,
    gracefulShutdown,
  });

  new JsonPaperRuntimeSessionSnapshotRepository(resolveSnapshotPath()).save(snapshot);
  return snapshot;
}

function printPreviousSnapshotNotice() {
  try {
    const repository = new JsonPaperRuntimeSessionSnapshotRepository(resolveSnapshotPath());
    const previous = repository.load();

    if (previous !== null) {
      console.log(`Previous snapshot detected: state=${previous.sessionState} graceful=${previous.gracefulShutdown}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Previous snapshot ignored: ${message}`);
  }
}

function handleRuntimeCommand(loop, rawLine) {
  const result = loop.handle(rawLine);
  saveSnapshot(loop, false);
  console.log(result.output);
}

function handleScriptedCommand(loop, rawLine) {
  const command = rawLine.trim().toLowerCase();

  if (command.length === 0) {
    return { shouldExit: false };
  }

  if (command === 'exit' || command === 'quit') {
    saveSnapshot(loop, true);
    return { shouldExit: true };
  }

  const discipline = handleOperatorDisciplineCommand(rawLine);

  if (discipline.blocked) {
    saveSnapshot(loop, false);
    return { shouldExit: false };
  }

  if (handlePaperRuntimeLedgerCommand(rawLine)) {
    saveSnapshot(loop, false);
    return { shouldExit: false };
  }

  handleRuntimeCommand(loop, rawLine);
  return { shouldExit: false };
}

function runScriptedSession() {
  runStartupRecovery();

  const loop = createLoop();
  printHelp();
  printPreviousSnapshotNotice();

  const input = fs.readFileSync(0, 'utf8');
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const result = handleScriptedCommand(loop, line);

    if (result.shouldExit) {
      console.log('RL.SYS paper runtime session closed.');
      return;
    }
  }

  saveSnapshot(loop, false);
  console.log('RL.SYS paper runtime session closed.');
}

function runInteractiveSession() {
  runStartupRecovery();

  const loop = createLoop();
  printHelp();
  printPreviousSnapshotNotice();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'paper> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const command = line.trim().toLowerCase();

    if (command === 'exit' || command === 'quit') {
      saveSnapshot(loop, true);
      rl.close();
      return;
    }

    handleRuntimeCommand(loop, line);
    rl.prompt();
  });

  rl.on('SIGINT', () => {
    saveSnapshot(loop, false);
    rl.close();
  });

  rl.on('close', () => {
    console.log('RL.SYS paper runtime session closed.');
  });
}

function main() {
  if (!process.stdin.isTTY) {
    runScriptedSession();
    return;
  }

  runInteractiveSession();
}

main();
