import { HistoricalSessionSnapshot } from '../session-audit/HistoricalSessionSnapshot';

export class ConsistencyScoreCalculator {
    public static calculate(snapshots: readonly HistoricalSessionSnapshot[]): number {
        if (snapshots.length === 0) {
            return 50; // Neutral starting score
        }

        let totalWinRate = 0;
        let totalConfirmationRate = 0;
        let positiveRoiSessions = 0;

        for (const snapshot of snapshots) {
            const winRate = snapshot.data.totalRounds > 0 ? snapshot.data.wins / snapshot.data.totalRounds : 0;
            totalWinRate += winRate;

            const totalSug = snapshot.data.confirmedSuggestions + snapshot.data.skippedSuggestions;
            const confRate = totalSug > 0 ? snapshot.data.confirmedSuggestions / totalSug : 0;
            totalConfirmationRate += confRate;

            if (snapshot.data.roi > 0) {
                positiveRoiSessions++;
            }
        }

        const count = snapshots.length;
        const avgWinRate = totalWinRate / count;
        const avgConfRate = totalConfirmationRate / count;
        const profitSessionRatio = positiveRoiSessions / count;

        // Score formula out of 100
        const winScore = Math.min(40, avgWinRate * 50); // up to 40 pts
        const confScore = Math.min(30, avgConfRate * 30); // up to 30 pts
        const profitScore = Math.min(30, profitSessionRatio * 30); // up to 30 pts

        const totalScore = Math.round(winScore + confScore + profitScore);
        return Math.max(0, Math.min(100, totalScore));
    }
}
