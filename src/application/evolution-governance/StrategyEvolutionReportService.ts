import { StrategyEvolutionGovernanceEngine } from './StrategyEvolutionGovernanceEngine';
import { StrategyEvolutionSnapshot } from './StrategyEvolutionSnapshot';

export class StrategyEvolutionReportService {
    constructor(private readonly engine: StrategyEvolutionGovernanceEngine) {}

    public getStrategyEvolution(sessionId: string = 'SESSION-000'): StrategyEvolutionSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }

    public getStrategyEvolutionHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<StrategyEvolutionSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
