import { DecisionLedger } from '../runtime/DecisionLedger';
import { DecisionReplayEngine } from './DecisionReplayEngine';
import { ReplayHistory } from './ReplayHistory';

export class ReplayReportService {
    private engine: DecisionReplayEngine;
    private history = new ReplayHistory();

    constructor(private readonly ledger: DecisionLedger) {
        this.engine = new DecisionReplayEngine(ledger);
    }

    public getReplay(decisionId: string, sessionId: string = 'SESSION-000') {
        let replay = this.history.getById(decisionId);
        if (!replay) {
            replay = this.engine.reconstruct(decisionId, sessionId);
            if (replay) {
                this.history.append(replay);
            }
        }
        return replay;
    }

    public getReplayHistory(sessionId: string = 'SESSION-000') {
        return this.history.getHistory(sessionId);
    }
}
