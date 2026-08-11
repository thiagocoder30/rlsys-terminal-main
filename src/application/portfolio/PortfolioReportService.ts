import { PortfolioIntelligenceEngine } from './PortfolioIntelligenceEngine';
import { PortfolioSnapshot } from './PortfolioSnapshot';

export class PortfolioReportService {
    constructor(private readonly engine: PortfolioIntelligenceEngine) {}

    public getPortfolioSnapshot(sessionId: string = 'SESSION-000'): PortfolioSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }
    
    public getPortfolioHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<PortfolioSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
