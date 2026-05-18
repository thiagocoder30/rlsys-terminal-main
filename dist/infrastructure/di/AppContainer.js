"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppContainer = void 0;
const LiveSessionCoordinator_1 = require("../../application/live/LiveSessionCoordinator");
const FileSnapshotLoader_1 = require("../storage/FileSnapshotLoader");
const SystemAdapters_1 = require("./SystemAdapters");
const RealGuards_1 = require("../defenses/RealGuards");
const FileTelemetryLogger_1 = require("../telemetry/FileTelemetryLogger");
class AppContainer {
    static bootstrap(config) {
        const snapshotLoader = new FileSnapshotLoader_1.FileSnapshotLoader(config.storageDirectory);
        const loadResult = snapshotLoader.load(config.targetSnapshotId, config.bootTimeMs);
        if (!loadResult.success)
            throw new Error(`CRITICAL_BOOT_FAILURE: ${loadResult.error}`);
        const healthGuard = new SystemAdapters_1.StandardHealthGuard();
        const financialGuard = new RealGuards_1.RealFinancialGuard(3, 10);
        const cooldownGuard = new RealGuards_1.FileCooldownGuard(config.storageDirectory);
        const tacticalEngine = new SystemAdapters_1.TacticalEngineAdapter(loadResult.snapshot);
        const logger = new FileTelemetryLogger_1.FileTelemetryLogger(config.storageDirectory);
        const coordinator = new LiveSessionCoordinator_1.LiveSessionCoordinator(healthGuard, financialGuard, cooldownGuard, tacticalEngine);
        if (cooldownGuard.isOperatorReady(config.bootTimeMs) === 'BLOCKED') {
            throw new Error("SISTEMA BLOQUEADO: Operador em período de Cooldown.");
        }
        return { coordinator, logger };
    }
}
exports.AppContainer = AppContainer;
