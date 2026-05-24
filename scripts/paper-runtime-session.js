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

function main() {
  const loop = createLoop();
  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "paper> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const command = line.trim().toLowerCase();

    if (command === "exit" || command === "quit") {
      rl.close();
      return;
    }

    const result = loop.handle(line);
    console.log(result.output);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("RL.SYS paper runtime session closed.");
  });
}

main();
