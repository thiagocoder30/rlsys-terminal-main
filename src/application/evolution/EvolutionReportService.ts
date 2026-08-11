import { InstitutionalEvolutionEngine } from './InstitutionalEvolutionEngine';
import { EvolutionSnapshot } from './EvolutionSnapshot';

export class EvolutionReportService {
    constructor(private readonly engine: InstitutionalEvolutionEngine) {}

    public getEvolutionSnapshot(sessionId: string = 'SESSION-000'): EvolutionSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }
    
    public getEvolutionHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<EvolutionSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
