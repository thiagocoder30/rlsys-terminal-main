"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("readline"));
const AppContainer_1 = require("./infrastructure/di/AppContainer");
const PythonOcrAdapter_1 = require("./infrastructure/ocr/PythonOcrAdapter");
// 1. Inicialização do Ecossistema (DDD) via Static Bootstrap
const bootResult = AppContainer_1.AppContainer.bootstrap({
    storageDirectory: './data', // Ajuste caso a sua pasta de ficheiros seja diferente
    targetSnapshotId: 'latest',
    bootTimeMs: Date.now()
});
const coordinator = bootResult.coordinator;
const ocrAdapter = new PythonOcrAdapter_1.PythonOcrAdapter();
// 2. Configuração do CLI Interativo
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
console.log("\n=========================================");
console.log(" 🎯 RLSYS SATELLITE - MOTOR TÁTICO CLI");
console.log("=========================================");
console.log(" - Digite um número (0-36) para girar a roleta.");
console.log(" - Digite 'ocr' para capturar histórico na nuvem.");
console.log(" - Digite 'sair' para encerrar.");
console.log("=========================================\n");
const askForInput = () => {
    rl.question("\x1b[33mAguardando comando/número: \x1b[0m", async (input) => {
        const command = input.trim().toLowerCase();
        if (command === 'sair' || command === 'exit') {
            console.log("\n[MAIN] Suspendendo Motor Tático. Até logo!");
            rl.close();
            process.exit(0);
        }
        if (command === 'ocr') {
            const historico = await ocrAdapter.extractHistory();
            if (historico.length > 0) {
                console.log(`\n[MAIN] Iniciando Ingestão de Cold Start (${historico.length} rodadas)...`);
                const historicoCronologico = [...historico].reverse();
                for (const num of historicoCronologico) {
                    try {
                        await coordinator.registerOutcome(num);
                        await coordinator.processLiveSpin(num);
                    }
                    catch (err) {
                        console.error(`[MAIN Erro] Falha ao injetar rodada ${num}:`, err);
                    }
                }
                console.log(`\x1b[32m[MAIN] Cold Start Concluído! Motor Matemático abastecido com ${historico.length} eventos.\x1b[0m\n`);
            }
            askForInput();
            return;
        }
        const num = parseInt(command, 10);
        if (!isNaN(num) && num >= 0 && num <= 36) {
            try {
                await coordinator.registerOutcome(num);
                const decisao = await coordinator.processLiveSpin(num);
                console.log(`\n\x1b[36m--- DECISÃO DE EDGE ---\x1b[0m`);
                console.dir(decisao, { depth: null, colors: true });
                console.log(`\x1b[36m-----------------------\x1b[0m\n`);
            }
            catch (err) {
                console.error(`\x1b[31m[MAIN Erro]\x1b[0m Falha ao processar rodada manual:`, err);
            }
        }
        else {
            console.log("\x1b[31m[!] Entrada inválida. Digite 0-36 ou 'ocr'.\x1b[0m\n");
        }
        askForInput();
    });
};
askForInput();
