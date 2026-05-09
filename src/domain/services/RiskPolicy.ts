import { BacktestSummary } from './BacktestEngine';
import { StrategyAnalysis } from './StrategyEngine';

export interface InstitutionalRiskDecision {
  allowed: boolean;
  reason: string;
  warnings: string[];
}

export class RiskPolicy {
  public evaluate(analysis: StrategyAnalysis, backtest?: BacktestSummary): InstitutionalRiskDecision {
    const warnings = [...analysis.risk.warnings];

    if (analysis.status !== 'ALLOWED') {
      return { allowed: false, reason: analysis.reason, warnings };
    }

    if (!backtest || backtest.trades < 30) {
      warnings.push('Backtest insuficiente: mínimo institucional de 30 trades walk-forward.');
      return { allowed: false, reason: 'Sinal bloqueado até haver backtest walk-forward suficiente.', warnings };
    }

    if (backtest.expectancyPerTrade <= 0 || backtest.roi <= 0) {
      warnings.push('Expectativa ou ROI walk-forward não positivos.');
      return { allowed: false, reason: 'Sinal bloqueado por ausência de vantagem histórica fora da amostra.', warnings };
    }

    if (backtest.maxDrawdown > 0.2) {
      warnings.push('Drawdown walk-forward acima de 20%.');
      return { allowed: false, reason: 'Sinal bloqueado por risco de drawdown elevado.', warnings };
    }

    return { allowed: true, reason: 'Sinal aprovado pela política mínima de risco.', warnings };
  }
}
