import { DecisionLedger, DecisionLedgerEntry } from '../DecisionLedger';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { randomUUID } from 'crypto';

export class ObservableDecisionLedger extends DecisionLedger {
    constructor(private readonly eventBus?: ObservabilityEventBus) {
        super();
    }

    public append(
        sessionId: string,
        runtimeVersion: string,
        decisionSummary: string,
        decisionExplanation: string
    ): DecisionLedgerEntry {
        const entry = super.append(sessionId, runtimeVersion, decisionSummary, decisionExplanation);
        
        // Technically DecisionExecuted is usually tied to QuantitativeEngine execution,
        // but adding it to ledger implies a decision was made and recorded.
        // For accurate timing, we'll emit this from the Controller wrapper or here.
        // We'll emit it here for the ledger event.
        this.eventBus?.publish('DecisionRecorded', runtimeVersion, randomUUID(), sessionId, { entry });
        
        return entry;
    }
}
