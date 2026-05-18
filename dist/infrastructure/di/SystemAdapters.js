"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardHealthGuard = exports.TacticalEngineAdapter = void 0;
const IntegrationPorts_1 = require("../../application/live/IntegrationPorts");
const PhysicsTacticalEngine_1 = require("../../domain/decision/PhysicsTacticalEngine");
class TacticalEngineAdapter {
    constructor(activeSnapshot) {
        this.engine = new PhysicsTacticalEngine_1.PhysicsTacticalEngine(activeSnapshot);
    }
    evaluate(liveState) {
        return this.engine.evaluate(liveState);
    }
}
exports.TacticalEngineAdapter = TacticalEngineAdapter;
class StandardHealthGuard {
    checkHealth() { return IntegrationPorts_1.DefenseStatus.CLEAR; }
}
exports.StandardHealthGuard = StandardHealthGuard;
