import { MultiSessionIntelligenceEngine } from './MultiSessionIntelligenceEngine';
import { GlobalSessionSnapshot } from './GlobalSessionSnapshot';

export class MultiSessionReportService {
    constructor(private readonly engine: MultiSessionIntelligenceEngine) {}

    public getMultiSession(sessionId: string = 'SESSION-000'): GlobalSessionSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }
    
    public getMultiSessionHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<GlobalSessionSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
