import { BacktestSummary } from './BacktestEngine';
import { StrategyAnalysis } from './StrategyEngine';

export interface ConfidenceBreakdown {
  entropyScore: number;
  signalScore: number;
  sampleScore: number;
  backtestScore: number;
  finalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  reasons: string[];
}

export class ConfidenceScorer {
  public score(analysis: StrategyAnalysis, backtest?: BacktestSummary): ConfidenceBreakdown {
    const reasons: string[] = [];
    const entropyScore = this.clamp((0.995 - analysis.metrics.normalizedEntropy) / 0.045);
    const signalScore = this.clamp(Math.max(0, ...analysis.signals.map(signal => signal.confidence)));
    const sampleScore = this.clamp((analysis.metrics.sampleSize - 120) / 880);
    const backtestScore = backtest ? this.backtestScore(backtest, reasons) : 0;

    if (entropyScore < 0.35) reasons.push('Entropia próxima do aleatório; baixa confiança no padrão detectado.');
    if (signalScore < 0.55) reasons.push('Sinais estatísticos fracos ou inconsistentes.');
    if (sampleScore < 0.25) reasons.push('Amostra ainda pequena para uma decisão institucional.');
    if (!backtest) reasons.push('Sem backtest walk-forward suficiente para confirmar robustez fora da amostra.');

    const finalScore = this.clamp(
      entropyScore * 0.25 +
      signalScore * 0.25 +
      sampleScore * 0.20 +
      backtestScore * 0.30
    );

    return {
      entropyScore,
      signalScore,
      sampleScore,
      backtestScore,
      finalScore,
      grade: this.grade(finalScore),
      reasons
    };
  }

  private backtestScore(backtest: BacktestSummary, reasons: string[]): number {
    const tradeScore = this.clamp(backtest.trades / 120);
    const expectancyScore = this.clamp(backtest.expectancyPerTrade / 0.0025);
    const roiScore = this.clamp(backtest.roi / 0.10);
    const drawdownScore = this.clamp(1 - backtest.maxDrawdown / 0.25);
    if (backtest.trades < 30) reasons.push('Menos de 30 trades walk-forward.');
    if (backtest.expectancyPerTrade <= 0) reasons.push('Expectativa walk-forward não positiva.');
    if (backtest.maxDrawdown > 0.2) reasons.push('Drawdown walk-forward acima do limite institucional.');
    return this.clamp(tradeScore * 0.25 + expectancyScore * 0.35 + roiScore * 0.20 + drawdownScore * 0.20);
  }

  private grade(score: number): ConfidenceBreakdown['grade'] {
    if (score >= 0.85) return 'A';
    if (score >= 0.70) return 'B';
    if (score >= 0.55) return 'C';
    if (score >= 0.40) return 'D';
    return 'F';
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }
}
