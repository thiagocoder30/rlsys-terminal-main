import { PredictiveScenarioEngine } from './PredictiveScenarioEngine';
import { ScenarioSnapshot } from './ScenarioSnapshot';

export class PredictiveReportService {
    constructor(private readonly engine: PredictiveScenarioEngine) {}

    public getPredictiveScenario(sessionId: string = 'SESSION-000'): ScenarioSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }
    
    public getPredictiveHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<ScenarioSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
