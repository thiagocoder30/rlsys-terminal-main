import { SessionAuditHistory } from './SessionAuditHistory';
import { StrategyPerformanceAnalyzer, StrategyPerformanceSummary } from './StrategyPerformanceAnalyzer';
import { BankrollEvolutionAnalyzer, BankrollEvolutionSummary } from './BankrollEvolutionAnalyzer';
import { SessionComparisonEngine, SessionComparisonResult } from './SessionComparisonEngine';
import { HistoricalSessionSnapshot } from './HistoricalSessionSnapshot';

export interface AuditPerformanceReport {
    evolution: BankrollEvolutionSummary;
    comparison: SessionComparisonResult;
    strategyPerformances: StrategyPerformanceSummary[];
}

export class SessionAuditReportService {
    constructor(private readonly history: SessionAuditHistory) {}

    public getSessionHistory(): HistoricalSessionSnapshot[] {
        return this.history.getRecords();
    }

    public getSessionAuditById(sessionId: string): HistoricalSessionSnapshot | undefined {
        return this.history.getById(sessionId);
    }

    public getPerformanceReport(): AuditPerformanceReport {
        const records = this.history.getRecords();
        return {
            evolution: BankrollEvolutionAnalyzer.analyze(records),
            comparison: SessionComparisonEngine.compare(records),
            strategyPerformances: StrategyPerformanceAnalyzer.analyze(records)
        };
    }
}
