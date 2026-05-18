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
exports.SnapshotUpdater = void 0;
const fs = __importStar(require("node:fs"));
const readline = __importStar(require("node:readline"));
const path = __importStar(require("node:path"));
const SelfLearningEngine_1 = require("../../domain/research/SelfLearningEngine");
class SnapshotUpdater {
    constructor(storageDirectory) {
        this.storageDirectory = storageDirectory;
    }
    async runRefinementCycle() {
        console.log("[CIENTISTA] Iniciando ingestão de telemetria (Stream Mode)...");
        const engine = new SelfLearningEngine_1.SelfLearningEngine();
        const telemetryFiles = fs.readdirSync(this.storageDirectory).filter(f => f.startsWith('session_telemetry_') && f.endsWith('.csv'));
        if (telemetryFiles.length === 0) {
            console.log("[CIENTISTA] Nenhum log de telemetria encontrado.");
            return;
        }
        // Leitura Assíncrona O(1) de Memória
        for (const file of telemetryFiles) {
            const filePath = path.join(this.storageDirectory, file);
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
            let isHeader = true;
            for await (const line of rl) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }
                // CSV: timestampMs,dealerId,wheelSpeed,targetSector,action,expectedEV,confidence,recommendedUnits,pnl,latencyMs
                const parts = line.split(',');
                if (parts.length >= 9) {
                    const dealerId = parts[1];
                    const speed = parts[2];
                    const sector = parseInt(parts[3], 10);
                    const action = parts[4];
                    const pnl = parseFloat(parts[8]);
                    engine.ingestTelemetry(dealerId, speed, sector, action, pnl);
                }
            }
        }
        console.log("[CIENTISTA] Processamento de ficheiros concluído. Refinando cérebro...");
        // Atualização Segura (Fail-Safe)
        const snapshotPath = path.join(this.storageDirectory, 'default_alpha.json');
        if (!fs.existsSync(snapshotPath))
            throw new Error("Snapshot base não encontrado.");
        const existingData = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
        const refinedData = engine.refineSnapshot(existingData);
        fs.writeFileSync(snapshotPath, JSON.stringify(refinedData, null, 2));
        console.log("[CIENTISTA] Snapshot default_alpha.json atualizado com sucesso. Novo EV e Confiança registados.");
    }
}
exports.SnapshotUpdater = SnapshotUpdater;
