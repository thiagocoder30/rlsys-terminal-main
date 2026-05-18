"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SnapshotUpdater_1 = require("./infrastructure/research/SnapshotUpdater");
async function main() {
    console.clear();
    console.log("\x1b[34m\x1b[1mRL.SYS CORE — AUTONOMOUS SCIENTIST (FASE 3)\x1b[0m\n");
    try {
        const updater = new SnapshotUpdater_1.SnapshotUpdater('./storage/snapshots');
        await updater.runRefinementCycle();
        console.log("\n\x1b[32m\x1b[1m[PROCESSO CONCLUÍDO]\x1b[0m O sistema está pronto para a próxima sessão.");
    }
    catch (error) {
        console.log(`\n\x1b[31m\x1b[1m[ERRO CRÍTICO]\x1b[0m ${error.message}`);
        process.exit(1);
    }
}
main();
