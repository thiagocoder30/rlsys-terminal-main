import { HistoricalSessionSnapshot } from '../session-audit/HistoricalSessionSnapshot';

export class OperatorBehaviorAnalyzer {
    public static analyze(snapshots: readonly HistoricalSessionSnapshot[]): string[] {
        if (snapshots.length === 0) {
            return ['Aguardando histórico de sessões para análise comportamental.'];
        }

        const insights: string[] = [];

        let totalConfirmed = 0;
        let totalSkipped = 0;
        let totalRounds = 0;
        let stopWinTriggers = 0;
        let stopLossTriggers = 0;
        let manualStops = 0;

        for (const snapshot of snapshots) {
            totalConfirmed += snapshot.data.confirmedSuggestions;
            totalSkipped += snapshot.data.skippedSuggestions;
            totalRounds += snapshot.data.totalRounds;

            if (snapshot.data.stopReason.includes('STOP_WIN')) {
                stopWinTriggers++;
            } else if (snapshot.data.stopReason.includes('STOP_LOSS')) {
                stopLossTriggers++;
            } else if (snapshot.data.stopReason.includes('MANUAL')) {
                manualStops++;
            }
        }

        const totalSuggestions = totalConfirmed + totalSkipped;
        const confirmationRate = totalSuggestions > 0 ? totalConfirmed / totalSuggestions : 0;

        if (confirmationRate >= 0.8) {
            insights.push('Elevada adesão e alinhamento com as recomendações institucionais.');
        } else if (confirmationRate <= 0.4 && totalSuggestions > 0) {
            insights.push('Elevada taxa de pulo de recomendações (operador seletivo ou divergente).');
        } else {
            insights.push('Adesão moderada às sugestões estratégicas.');
        }

        if (stopWinTriggers > 0 || stopLossTriggers > 0) {
            insights.push('Execução com disciplina aos gatilhos automáticos de parada de risco.');
        }

        if (manualStops > snapshots.length * 0.5) {
            insights.push('Frequente encerramento manual antecipado de sessões.');
        }

        const recent = snapshots.slice(-3);
        const winRates = recent.map(s => s.data.totalRounds > 0 ? s.data.wins / s.data.totalRounds : 0);
        const isWinRateImproving = winRates.length >= 2 && winRates[winRates.length - 1] > winRates[0];

        if (isWinRateImproving) {
            insights.push('Excelente consistência e evolução positiva do acerto recente.');
        }

        if (insights.length === 0) {
            insights.push('Padrão operacional estável dentro dos parâmetros normais.');
        }

        return insights;
    }
}
