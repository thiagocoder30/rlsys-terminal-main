import { RuntimeSessionManager } from './RuntimeSessionManager';
import { SnapshotManager } from './SnapshotManager';
import { HeartbeatManager } from './HeartbeatManager';
import { RuntimeTelemetry } from './RuntimeTelemetry';
import { SessionSnapshot } from './SessionSnapshot';
import { DecisionLedger } from './DecisionLedger';

export class RecoveryPipeline {
    constructor(
        private sessionManager: RuntimeSessionManager,
        private snapshotManager: SnapshotManager,
        private heartbeatManager: HeartbeatManager,
        private telemetry: RuntimeTelemetry,
        private ledger: DecisionLedger
    ) {}

    public recoverSession(sessionId: string): boolean {
        const snapshot = this.snapshotManager.getLatestSnapshot(sessionId);
        const session = this.sessionManager.getSession(sessionId);

        if (!session) return false;

        if (!this.validateSnapshot(snapshot)) {
            this.sessionManager.lockSession(sessionId);
            this.ledger.append(sessionId, session.runtimeVersion, "Recovery Failed", "Invalid or missing snapshot. Session locked.");
            return false;
        }

        this.sessionManager.updateSession(sessionId, {
            status: 'RECOVERED',
            currentBankroll: snapshot!.bankroll,
            peakBankroll: snapshot!.peakBankroll,
            drawdown: snapshot!.drawdown,
            burnIn: snapshot!.burnIn,
            cooldown: snapshot!.cooldown,
            snapshotVersion: session.snapshotVersion + 1
        });

        this.heartbeatManager.heartbeat(sessionId);
        this.telemetry.incrementRecoveries();
        return true;
    }

    private validateSnapshot(snapshot: SessionSnapshot | null): boolean {
        if (!snapshot) return false;
        if (!snapshot.sessionId || !snapshot.timestampUtc) return false;
        if (snapshot.bankroll < 0) return false;
        return true;
    }
}
