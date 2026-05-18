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
exports.FileTelemetryLogger = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class FileTelemetryLogger {
    constructor(storageDirectory) {
        this.isInitialized = false;
        if (!fs.existsSync(storageDirectory)) {
            fs.mkdirSync(storageDirectory, { recursive: true });
        }
        const dateStr = new Date().toISOString().split('T')[0];
        this.filePath = path.join(storageDirectory, `session_telemetry_${dateStr}.csv`);
        // Injetar cabeçalho CSV se o ficheiro for novo
        if (!fs.existsSync(this.filePath)) {
            try {
                const header = "timestampMs,dealerId,wheelSpeed,targetSector,action,expectedEV,confidence,recommendedUnits,pnl,latencyMs\n";
                fs.writeFileSync(this.filePath, header, 'utf-8');
                this.isInitialized = true;
            }
            catch (e) {
                console.error("[TELEMETRIA] Falha ao criar cabeçalho do log.", e);
            }
        }
        else {
            this.isInitialized = true;
        }
    }
    /**
     * Gravação Fire-and-Forget (Assíncrona).
     * O(1) na main thread, não trava o Event Loop do Node.js.
     */
    logSpin(data) {
        if (!this.isInitialized)
            return;
        const row = `${data.timestampMs},${data.dealerId},${data.wheelSpeed},${data.targetSector},${data.action},${data.expectedEV.toFixed(4)},${data.confidence.toFixed(4)},${data.recommendedUnits},${data.pnl},${data.latencyMs.toFixed(2)}\n`;
        // Fail-Safe: Se o disco falhar, o callback captura o erro sem derrubar o sistema.
        fs.appendFile(this.filePath, row, 'utf-8', (err) => {
            if (err) {
                console.error("\n[AVISO DE SISTEMA] Falha não-fatal ao gravar telemetria no disco.");
            }
        });
    }
}
exports.FileTelemetryLogger = FileTelemetryLogger;
