'use strict';
require('./paper-runtime-ledger-command-preload');
const readline = require("node:readline");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");
const {
  PaperRuntimeReplCommandAdapter,
} = require("../dist/application/runtime/PaperRuntimeReplCommandAdapter.js");
const {
  PaperRuntimeInteractiveLoop,
} = require("../dist/application/runtime/PaperRuntimeInteractiveLoop.js");
const {
  PaperRuntimeSessionSnapshotFactory,
} = require("../dist/application/runtime/PaperRuntimeSessionSnapshot.js");
const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require("../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js");

const SNAPSHOT_PATH = "data/paper-runtime/session-snapshot.json";

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
    "RL.SYS PAPER RUNTIME SESSION",
    "",
    "Commands:",
    "  prepare",
    "  start",
    "  status",
    "  pause",
    "  resume",
    "  finish",
    "  exit",
    "",
  ].join("\n"));
}

function saveSnapshot(loop, gracefulShutdown) {
  const state = loop.currentState();
  const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
    sessionState: state.sessionState,
    iteration: state.iteration,
    lastCommand: state.lastCommand,
    gracefulShutdown,
  });

  new JsonPaperRuntimeSessionSnapshotRepository(SNAPSHOT_PATH).save(snapshot);
  return snapshot;
}

function main() {
  const loop = createLoop();
  const repository = new JsonPaperRuntimeSessionSnapshotRepository(SNAPSHOT_PATH);
  const previous = repository.load();

  printHelp();

  if (previous !== null) {
    console.log(`Previous snapshot detected: state=${previous.sessionState} graceful=${previous.gracefulShutdown}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "paper> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const command = line.trim().toLowerCase();

    if (command === "exit" || command === "quit") {
      saveSnapshot(loop, true);
      rl.close();
      return;
    }

    const result = loop.handle(line);
    saveSnapshot(loop, false);
    console.log(result.output);
    rl.prompt();
  });

  rl.on("SIGINT", () => {
    saveSnapshot(loop, false);
    rl.close();
  });

  rl.on("close", () => {
    console.log("RL.SYS paper runtime session closed.");
  });
}

main();

/**
 * Sprint 103 — Paper Runtime Snapshot Recovery
 *
 * Appended at EOF intentionally to preserve the legacy interactive runtime source,
 * including readline-based contracts already covered by existing tests.
 */
try {
  const { runPaperRuntimeSnapshotRecovery } = require('./paper-runtime-snapshot-recovery');
  runPaperRuntimeSnapshotRecovery();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RL.SYS paper runtime recovery bootstrap failed: ${message}`);
  process.exitCode = 1;
}
