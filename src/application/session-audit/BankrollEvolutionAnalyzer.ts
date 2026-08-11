import { HistoricalSessionSnapshot } from './HistoricalSessionSnapshot';

export interface BankrollEvolutionSummary {
    startingBankroll: number;
    currentBankroll: number;
    highestBankroll: number;
    lowestBankroll: number;
    maxDrawdown: number;
    growthRate: number;
    sessionCount: number;
}

export class BankrollEvolutionAnalyzer {
    public static analyze(snapshots: HistoricalSessionSnapshot[]): BankrollEvolutionSummary {
        if (snapshots.length === 0) {
            return {
                startingBankroll: 0,
                currentBankroll: 0,
                highestBankroll: 0,
                lowestBankroll: 0,
                maxDrawdown: 0,
                growthRate: 0,
                sessionCount: 0
            };
        }

        const startingBankroll = snapshots[0].data.initialBankroll;
        const currentBankroll = snapshots[snapshots.length - 1].data.finalBankroll;

        let highestBankroll = startingBankroll;
        let lowestBankroll = startingBankroll;
        let maxDrawdown = 0;

        for (const snapshot of snapshots) {
            const minBankroll = Math.min(snapshot.data.initialBankroll, snapshot.data.finalBankroll);
            const maxBankroll = Math.max(snapshot.data.initialBankroll, snapshot.data.finalBankroll);

            if (maxBankroll > highestBankroll) {
                highestBankroll = maxBankroll;
            }
            if (minBankroll < lowestBankroll) {
                lowestBankroll = minBankroll;
            }

            const peak = Math.max(startingBankroll, highestBankroll);
            if (peak > 0) {
                const dd = (peak - snapshot.data.finalBankroll) / peak;
                if (dd > maxDrawdown) {
                    maxDrawdown = dd;
                }
            }
        }

        const growthRate = startingBankroll > 0 ? (currentBankroll - startingBankroll) / startingBankroll : 0;

        return {
            startingBankroll,
            currentBankroll,
            highestBankroll,
            lowestBankroll,
            maxDrawdown,
            growthRate,
            sessionCount: snapshots.length
        };
    }
}
