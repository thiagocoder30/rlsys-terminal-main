"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:readline/promises");
const node_process_1 = require("node:process");
const node_path_1 = require("node:path");
const runtime_1 = require("./application/runtime");
const replay_1 = require("./infrastructure/replay");
const journal_1 = require("./infrastructure/journal");
const session_1 = require("./domain/session");
async function main() {
    const identity = new session_1.RuntimeSessionIdentityFactory().create();
    const replayPath = (0, node_path_1.join)(process.cwd(), 'data', 'replay');
    const journalPath = (0, node_path_1.join)(process.cwd(), 'data', 'journal');
    const replayRepository = new replay_1.JsonLinesReplayRepository(replayPath);
    const journalRepository = new journal_1.JsonLinesRuntimeSessionJournalRepository(journalPath);
    const kernel = new runtime_1.RuntimeKernel(replayRepository, undefined, undefined, undefined, undefined, undefined, undefined, undefined, journalRepository, identity);
    const shutdown = new runtime_1.RuntimeShutdownCoordinator(kernel, journalRepository, identity);
    const terminal = (0, promises_1.createInterface)({ input: node_process_1.stdin, output: node_process_1.stdout });
    const closeTerminal = () => {
        terminal.close();
    };
    const requestShutdown = (reason) => {
        const result = shutdown.shutdown(reason);
        console.log(result.message);
        closeTerminal();
        if (reason !== 'REPL_CLOSED') {
            process.exitCode = 0;
        }
    };
    process.once('SIGINT', () => requestShutdown('SIGINT'));
    process.once('SIGTERM', () => requestShutdown('SIGTERM'));
    process.once('uncaughtException', (error) => {
        const result = shutdown.shutdown('UNCAUGHT_EXCEPTION');
        console.error(result.message);
        console.error(error.message);
        closeTerminal();
        process.exitCode = 1;
    });
    process.once('unhandledRejection', (reason) => {
        const result = shutdown.shutdown('UNHANDLED_REJECTION');
        console.error(result.message);
        console.error(reason instanceof Error ? reason.message : String(reason));
        closeTerminal();
        process.exitCode = 1;
    });
    terminal.once('close', () => {
        if (!shutdown.isClosed()) {
            shutdown.shutdown('REPL_CLOSED');
        }
    });
    console.log('╔════════ RL.SYS CORE ════════╗');
    console.log('║ Institutional Runtime Kernel ║');
    console.log(`║ Session: ${identity.sessionId} ║`);
    console.log('║ Type 0-36, status, or quit   ║');
    console.log('╚══════════════════════════════╝');
    try {
        let shouldContinue = true;
        while (shouldContinue && !shutdown.isClosed()) {
            const command = await terminal.question('rlsys> ');
            const result = await kernel.handle(command);
            console.log(result.output);
            shouldContinue = result.shouldContinue;
        }
        if (!shutdown.isClosed()) {
            shutdown.shutdown('OPERATOR_QUIT');
        }
    }
    catch (error) {
        if (!shutdown.isClosed()) {
            shutdown.shutdown('UNKNOWN');
        }
        const message = error instanceof Error ? error.message : 'unknown runtime error';
        console.error('RL.SYS CORE entered fail-closed shutdown.');
        console.error(message);
        process.exitCode = 1;
    }
    finally {
        closeTerminal();
    }
}
void main();
