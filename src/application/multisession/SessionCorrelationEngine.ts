export class SessionCorrelationEngine {
    public calculateCorrelationIndex(
        currentPerformance: number,
        historicalPerformanceAvg: number,
        currentEvolution: number,
        historicalEvolutionAvg: number
    ): number {
        // A simple weighted correlation index between 0 and 1
        const perfDiff = Math.abs(currentPerformance - historicalPerformanceAvg);
        const evoDiff = Math.abs(currentEvolution - historicalEvolutionAvg);
        
        const correlation = 1.0 - ((perfDiff * 0.6) + (evoDiff * 0.4));
        return Math.max(0, Math.min(1, correlation));
    }
}
