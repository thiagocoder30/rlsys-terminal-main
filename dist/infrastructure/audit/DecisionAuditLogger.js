"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionAuditLogger = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class DecisionAuditLogger {
    constructor(filePath) {
        this.filePath = filePath;
    }
    async append(record) {
        await promises_1.default.mkdir(path_1.default.dirname(this.filePath), { recursive: true });
        await promises_1.default.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
    }
}
exports.DecisionAuditLogger = DecisionAuditLogger;
