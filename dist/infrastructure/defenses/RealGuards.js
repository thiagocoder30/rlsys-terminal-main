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
exports.FileCooldownGuard = exports.RealFinancialGuard = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const IntegrationPorts_1 = require("../../application/live/IntegrationPorts");
class RealFinancialGuard {
    constructor(maxConsecutiveLosses, stopLossLimit) {
        this.maxConsecutiveLosses = maxConsecutiveLosses;
        this.stopLossLimit = stopLossLimit;
        this.currentBalance = 0;
        this.consecutiveLosses = 0;
    }
    authorizeEntry() {
        if (this.consecutiveLosses >= this.maxConsecutiveLosses)
            return IntegrationPorts_1.DefenseStatus.BLOCKED;
        if (this.currentBalance <= -this.stopLossLimit)
            return IntegrationPorts_1.DefenseStatus.BLOCKED;
        return IntegrationPorts_1.DefenseStatus.CLEAR;
    }
    registerPnL(amount) {
        this.currentBalance += amount;
        if (amount < 0) {
            this.consecutiveLosses++;
        }
        else if (amount > 0) {
            this.consecutiveLosses = 0; // Reset na vitória
        }
    }
    getConsecutiveLosses() { return this.consecutiveLosses; }
}
exports.RealFinancialGuard = RealFinancialGuard;
class FileCooldownGuard {
    constructor(storageDirectory) {
        this.filePath = path.join(storageDirectory, 'cooldown_state.json');
        if (!fs.existsSync(storageDirectory))
            fs.mkdirSync(storageDirectory, { recursive: true });
    }
    isOperatorReady(currentTimeMs) {
        if (!fs.existsSync(this.filePath))
            return IntegrationPorts_1.DefenseStatus.CLEAR;
        try {
            const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            if (currentTimeMs < data.lockedUntilMs)
                return IntegrationPorts_1.DefenseStatus.BLOCKED;
            return IntegrationPorts_1.DefenseStatus.CLEAR;
        }
        catch {
            return IntegrationPorts_1.DefenseStatus.BLOCKED; // Fail-Closed em caso de corrupção
        }
    }
    triggerCooldown(durationMs, currentTimeMs) {
        const state = { lockedUntilMs: currentTimeMs + durationMs };
        fs.writeFileSync(this.filePath, JSON.stringify(state)); // Gravação O(1) Idempotente
    }
}
exports.FileCooldownGuard = FileCooldownGuard;
