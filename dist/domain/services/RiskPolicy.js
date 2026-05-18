"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskPolicy = void 0;
class RiskPolicy {
    evaluate(analysis, backtest, confidence, monteCarlo, bayesianEdge, regime) {
        const warnings = [
            ...analysis.risk.warnings,
            ...(confidence?.reasons ?? []),
            ...(bayesianEdge?.reasons ?? []),
            ...(regime?.warnings ?? [])
        ];
        if (analysis.status !== 'ALLOWED') {
            return { allowed: false, reason: analysis.reason, warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (!backtest || backtest.trades < 30) {
            warnings.push('Backtest insuficiente: mínimo institucional de 30 trades walk-forward.');
            return { allowed: false, reason: 'Sinal bloqueado até haver backtest walk-forward suficiente.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (backtest.expectancyPerTrade <= 0 || backtest.roi <= 0) {
            warnings.push('Expectativa ou ROI walk-forward não positivos.');
            return { allowed: false, reason: 'Sinal bloqueado por ausência de vantagem histórica fora da amostra.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (backtest.maxDrawdown > 0.2) {
            warnings.push('Drawdown walk-forward acima de 20%.');
            return { allowed: false, reason: 'Sinal bloqueado por risco de drawdown elevado.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (confidence && confidence.finalScore < 0.55) {
            warnings.push(`Confidence score ${confidence.finalScore.toFixed(3)} abaixo do mínimo institucional de 0.55.`);
            return { allowed: false, reason: 'Sinal bloqueado por baixa confiança agregada.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (monteCarlo && monteCarlo.probabilityOfRuin > 0.05) {
            warnings.push(`Risco de ruína Monte Carlo ${(monteCarlo.probabilityOfRuin * 100).toFixed(2)}% acima do limite de 5%.`);
            return { allowed: false, reason: 'Sinal bloqueado por risco de ruína elevado.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (monteCarlo && monteCarlo.p95MaxDrawdown > 0.35) {
            warnings.push(`P95 de drawdown Monte Carlo ${(monteCarlo.p95MaxDrawdown * 100).toFixed(2)}% acima do limite de 35%.`);
            return { allowed: false, reason: 'Sinal bloqueado por estresse Monte Carlo elevado.', warnings, confidence, monteCarlo, bayesianEdge, regime };
        }
        if (bayesianEdge && bayesianEdge.verdict !== 'SUPPORTED') {
            return {
                allowed: false,
                reason: `Sinal bloqueado por validação bayesiana ${bayesianEdge.verdict.toLowerCase()}.`,
                warnings,
                confidence,
                monteCarlo,
                bayesianEdge,
                regime
            };
        }
        if (regime && regime.label === 'UNSTABLE') {
            return {
                allowed: false,
                reason: 'Sinal bloqueado por regime estatístico instável.',
                warnings,
                confidence,
                monteCarlo,
                bayesianEdge,
                regime
            };
        }
        return { allowed: true, reason: 'Sinal aprovado pela política institucional v0.8.', warnings, confidence, monteCarlo, bayesianEdge, regime };
    }
}
exports.RiskPolicy = RiskPolicy;
