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
exports.FileSnapshotLoader = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const SnapshotValidator_1 = require("../../domain/knowledge/SnapshotValidator");
class FileSnapshotLoader {
    /**
     * @param storageDirectory O diretório onde os ficheiros .json compilados são armazenados.
     */
    constructor(storageDirectory) {
        this.storageDirectory = storageDirectory;
    }
    /**
     * Carrega, faz o parse e valida a integridade física e temporal do Snapshot.
     * Operação bloqueante segura (feita apenas no pré-carregamento da sessão).
     */
    load(snapshotId, currentTimeMs) {
        // Sanitização básica do nome do ficheiro contra path traversal
        const safeSnapshotId = path.basename(snapshotId);
        const filePath = path.join(this.storageDirectory, `${safeSnapshotId}.json`);
        // 1. Integridade Física: O Ficheiro existe?
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'SNAPSHOT_FILE_NOT_FOUND' };
        }
        try {
            // 2. I/O: Leitura do Ficheiro
            const rawData = fs.readFileSync(filePath, 'utf-8');
            // 3. Parse: Transforma String em Objeto (Pode falhar se corrompido na transferência)
            const parsedObject = JSON.parse(rawData);
            // 4. Validação de Domínio (Schema e Decaimento Temporal via Sprint 038)
            const validation = SnapshotValidator_1.SnapshotValidator.validate(parsedObject, currentTimeMs);
            if (!validation.isValid) {
                return { success: false, error: `INTEGRITY_OR_EXPIRATION_FAILURE: ${validation.error}` };
            }
            // 5. Sucesso: Pacote ancorado na memória, estritamente tipado.
            return { success: true, snapshot: parsedObject };
        }
        catch (error) {
            return { success: false, error: 'JSON_PARSE_ERROR_CORRUPT_FILE' };
        }
    }
}
exports.FileSnapshotLoader = FileSnapshotLoader;
