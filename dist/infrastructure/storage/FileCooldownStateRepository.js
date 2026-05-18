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
exports.FileCooldownStateRepository = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class FileCooldownStateRepository {
    constructor(storageDirectory) {
        if (!fs.existsSync(storageDirectory)) {
            fs.mkdirSync(storageDirectory, { recursive: true });
        }
        this.filePath = path.join(storageDirectory, 'cooldown_state.json');
    }
    save(state) {
        try {
            // Uso sincrono garantindo atomicidade antes que o processo morra
            fs.writeFileSync(this.filePath, JSON.stringify(state), 'utf-8');
        }
        catch (error) {
            console.error('[FileCooldownRepo] Erro ao salvar estado:', error);
        }
    }
    load() {
        try {
            if (!fs.existsSync(this.filePath))
                return null;
            const data = fs.readFileSync(this.filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error('[FileCooldownRepo] Erro ao carregar estado. Assumindo estado limpo.', error);
            return null;
        }
    }
    clear() {
        try {
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath);
            }
        }
        catch (error) {
            console.error('[FileCooldownRepo] Erro ao limpar estado:', error);
        }
    }
}
exports.FileCooldownStateRepository = FileCooldownStateRepository;
