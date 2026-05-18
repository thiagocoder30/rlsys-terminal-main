"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonlSignalRepository = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Persistência append-only em JSONL.
 * Evita dependências nativas como sqlite3, tornando o projeto mais confiável em Termux/Arch/Android.
 */
class JsonlSignalRepository {
    constructor(filePath) {
        this.filePath = filePath;
    }
    async init() {
        await fs_1.promises.mkdir(path_1.default.dirname(this.filePath), { recursive: true });
        try {
            await fs_1.promises.access(this.filePath);
        }
        catch {
            await fs_1.promises.writeFile(this.filePath, '', 'utf8');
        }
    }
    async saveSignal(signal) {
        const record = JSON.stringify({ ...signal, persistedAt: new Date().toISOString() });
        await fs_1.promises.appendFile(this.filePath, `${record}\n`, 'utf8');
    }
    async getHistory(limit) {
        const content = await fs_1.promises.readFile(this.filePath, 'utf8');
        return content
            .split('\n')
            .filter(Boolean)
            .slice(-Math.max(0, limit))
            .map(line => JSON.parse(line))
            .reverse();
    }
    async close() {
        // JSONL append-only não mantém conexão aberta.
    }
}
exports.JsonlSignalRepository = JsonlSignalRepository;
