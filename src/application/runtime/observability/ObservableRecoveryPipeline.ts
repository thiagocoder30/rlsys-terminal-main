import { RecoveryPipeline } from '../RecoveryPipeline';
import { RuntimeSessionManager } from '../RuntimeSessionManager';
import { SnapshotManager } from '../SnapshotManager';
import { HeartbeatManager } from '../HeartbeatManager';
import { RuntimeTelemetry } from '../RuntimeTelemetry';
import { DecisionLedger } from '../DecisionLedger';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { randomUUID } from 'crypto';

export class ObservableRecoveryPipeline extends RecoveryPipeline {
    constructor(
        sessionManager: RuntimeSessionManager,
        snapshotManager: SnapshotManager,
        heartbeatManager: HeartbeatManager,
        telemetry: RuntimeTelemetry,
        ledger: DecisionLedger,
        private readonly eventBus: ObservabilityEventBus
    ) {
        super(sessionManager, snapshotManager, heartbeatManager, telemetry, ledger);
    }

    public recoverSession(sessionId: string): boolean {
        const start = Date.now();
        const success = super.recoverSession(sessionId);
        const recoveryTimeMs = Date.now() - start;

        if (success) {
            this.eventBus.publish('SnapshotRecovered', '5.0.0', randomUUID(), sessionId, { recoveryTimeMs });
        } else {
            this.eventBus.publish('RuntimeWarning', '5.0.0', randomUUID(), sessionId, { 
                message: 'Recovery failed',
                recoveryTimeMs
            });
        }
        return success;
    }
}
