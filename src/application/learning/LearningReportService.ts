import { InstitutionalLearningEngine } from './InstitutionalLearningEngine';
import { LearningSnapshot } from './LearningSnapshot';

export class LearningReportService {
    constructor(private readonly engine: InstitutionalLearningEngine) {}

    public getLearningSnapshot(sessionId: string = 'SESSION-000'): LearningSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }
    
    public getLearningHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<LearningSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
