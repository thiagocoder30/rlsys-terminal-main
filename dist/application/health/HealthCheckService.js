"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class HealthCheckService {
    constructor(version, dataPath = './data') {
        this.version = version;
        this.dataPath = dataPath;
    }
    async readiness() {
        const checks = {
            runtime: { status: 'ok', details: `node ${process.version}` },
            filesystem: await this.checkFilesystem()
        };
        const degraded = Object.values(checks).some(check => check.status !== 'ok');
        return {
            status: degraded ? 'degraded' : 'ok',
            service: 'rl-sys-core',
            version: this.version,
            timestamp: new Date().toISOString(),
            checks
        };
    }
    async checkFilesystem() {
        try {
            await promises_1.default.mkdir(this.dataPath, { recursive: true });
            const probe = path_1.default.join(this.dataPath, '.healthcheck');
            await promises_1.default.writeFile(probe, String(Date.now()), 'utf8');
            await promises_1.default.unlink(probe);
            return { status: 'ok', details: 'data directory is writable' };
        }
        catch (error) {
            return { status: 'degraded', details: error instanceof Error ? error.message : String(error) };
        }
    }
}
exports.HealthCheckService = HealthCheckService;
