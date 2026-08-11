import { SessionControlEngine } from './SessionControlEngine';
import { SessionHistory } from './SessionHistory';

export class SessionReportService {
    constructor(
        private engine: SessionControlEngine,
        private history: SessionHistory
    ) {}

    public getCurrentSessionState() {
        return this.engine.getCurrentState();
    }

    public getSessionHistory() {
        return this.history.getHistory();
    }
}
