"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapitalExposureSimulator = void 0;
const RouletteStats_1 = require("../services/RouletteStats");
const DEFAULT_OPTIONS = {
    initialCapital: 1000,
    baseStakeFraction: 0.01,
    maxStakeFraction: 0.035,
    ruinThresholdFraction: 0.55,
    recoveryThresholdFraction: 0.97,
    adaptiveSizing: true,
    sampleWindow: 80
};
const DEFAULT_POLICIES = [
    { name: 'fixed_conservative', description: 'Stake fixa conservadora sem aceleração após perdas.', multiplier: 0.65, adaptive: false, maxConsecutiveLossMultiplier: 1 },
    { name: 'fixed_base', description: 'Stake fixa base para comparação institucional.', multiplier: 1, adaptive: false, maxConsecutiveLossMultiplier: 1 },
    { name: 'adaptive_prudent', description: 'Stake adaptativa com redução em drawdown e leve ajuste em capital acima do pico.', multiplier: 1, adaptive: true, maxConsecutiveLossMultiplier: 1.15 },
    { name: 'aggressive_pressure', description: 'Exposição agressiva para medir saturação e risco convexo.', multiplier: 2.1, adaptive: true, maxConsecutiveLossMultiplier: 1.6 },
    { name: 'martingale_like_rejected', description: 'Modelo progressivo adversarial para rejeitar convexidade perigosa.', multiplier: 1.2, adaptive: true, maxConsecutiveLossMultiplier: 2.4 }
];
class CapitalExposureSimulator {
    constructor(options = {}) {
        this.stats = new RouletteStats_1.RouletteStats();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    simulate(history) {
        const values = this.validate(history);
        const sectors = values.map(value => this.stats.sectorOf(value));
        const target = this.learnTarget(sectors);
        const outcomes = DEFAULT_POLICIES.map(policy => this.replayPolicy(sectors, target, policy));
        const summary = this.summarize(values.length, outcomes);
        return { summary, outcomes, options: this.options };
    }
    validate(history) {
        const result = RouletteStats_1.RouletteStats.validate(history);
        if (!result.ok)
            throw new Error(`invalid_capital_history: ${result.errors.slice(0, 3).join('; ')}`);
        if (result.values.length < Math.max(120, this.options.sampleWindow * 2)) {
            throw new Error('insufficient_capital_history: minimum 160 valid spins recommended');
        }
        if (this.options.initialCapital <= 0)
            throw new Error('invalid_initial_capital');
        if (this.options.baseStakeFraction <= 0 || this.options.maxStakeFraction <= 0)
            throw new Error('invalid_stake_configuration');
        return result.values;
    }
    learnTarget(sectors) {
        const tradable = ['voisins', 'tiers', 'orphelins'];
        const train = sectors.slice(0, Math.max(40, Math.floor(sectors.length * 0.3)));
        const counts = new Map(tradable.map(sector => [sector, 0]));
        for (const sector of train) {
            if (sector === 'voisins' || sector === 'tiers' || sector === 'orphelins')
                counts.set(sector, (counts.get(sector) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    }
    replayPolicy(sectors, target, policy) {
        let capital = this.options.initialCapital;
        let peak = capital;
        let maxDrawdown = 0;
        let underwaterRun = 0;
        let longestUnderwaterRun = 0;
        let firstRecovery = null;
        let consecutiveLosses = 0;
        let ruinEvents = 0;
        let maxExposure = 0;
        const exposures = [];
        const equityCurve = [];
        sectors.forEach((sector, index) => {
            const drawdownBefore = peak <= 0 ? 0 : (peak - capital) / peak;
            const stakeFraction = this.stakeFraction(policy, drawdownBefore, consecutiveLosses, capital / this.options.initialCapital);
            const stake = Math.min(capital * stakeFraction, capital * this.options.maxStakeFraction);
            const won = sector === target;
            const pnl = won ? this.winPnl(target, stake) : -stake;
            capital = Math.max(0, capital + pnl);
            peak = Math.max(peak, capital);
            const drawdown = peak <= 0 ? 0 : (peak - capital) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
            consecutiveLosses = won ? 0 : consecutiveLosses + 1;
            underwaterRun = drawdown > 0 ? underwaterRun + 1 : 0;
            longestUnderwaterRun = Math.max(longestUnderwaterRun, underwaterRun);
            const exposure = this.options.initialCapital <= 0 ? 0 : stake / this.options.initialCapital;
            maxExposure = Math.max(maxExposure, exposure);
            exposures.push(exposure);
            const ruined = capital <= this.options.initialCapital * this.options.ruinThresholdFraction;
            if (ruined)
                ruinEvents += 1;
            if (firstRecovery === null && index > 0 && capital >= this.options.initialCapital * this.options.recoveryThresholdFraction && drawdownBefore > 0.08)
                firstRecovery = index;
            equityCurve.push({ index, capital: round(capital), stake: round(stake), pnl: round(pnl), drawdown: round(drawdown), exposure: round(exposure), ruined });
        });
        const finalCapital = capital;
        const roi = finalCapital / this.options.initialCapital - 1;
        const averageExposure = average(exposures);
        const recoveryFactor = maxDrawdown <= 0 ? Math.max(0, roi) : Math.max(0, roi) / maxDrawdown;
        const capitalEfficiency = this.capitalEfficiency(roi, maxDrawdown, averageExposure, longestUnderwaterRun, sectors.length);
        const ruinProbability = this.ruinProbability(maxDrawdown, ruinEvents, sectors.length, maxExposure, roi);
        const aggressiveBaseline = this.options.baseStakeFraction * policy.multiplier;
        const convexityOfLoss = round(Math.min(1, Math.max(0, (maxDrawdown / Math.max(0.0001, averageExposure * 12)) + (aggressiveBaseline / this.options.maxStakeFraction) * 0.15 + (roi < 0 ? 0.15 : 0))));
        const riskGrade = this.grade(maxDrawdown, ruinProbability, maxExposure, capitalEfficiency, convexityOfLoss);
        return {
            policy: policy.name,
            description: policy.description,
            finalCapital: round(finalCapital),
            roi: round(roi),
            maxDrawdown: round(maxDrawdown),
            maxExposure: round(maxExposure),
            averageExposure: round(averageExposure),
            capitalEfficiency: round(capitalEfficiency),
            recoveryFactor: round(recoveryFactor),
            longestUnderwaterRun,
            timeToRecovery: firstRecovery,
            ruinEvents,
            ruinProbability: round(ruinProbability),
            convexityOfLoss,
            riskGrade,
            equityCurve
        };
    }
    stakeFraction(policy, drawdown, consecutiveLosses, capitalRatio) {
        let fraction = this.options.baseStakeFraction * policy.multiplier;
        if (policy.adaptive && this.options.adaptiveSizing) {
            const drawdownThrottle = drawdown > 0.25 ? 0.45 : drawdown > 0.15 ? 0.65 : drawdown > 0.08 ? 0.8 : 1;
            const lossPressure = Math.min(policy.maxConsecutiveLossMultiplier, 1 + consecutiveLosses * 0.08);
            const capitalThrottle = capitalRatio < 0.75 ? 0.55 : capitalRatio < 0.9 ? 0.75 : 1;
            fraction *= drawdownThrottle * lossPressure * capitalThrottle;
        }
        return Math.min(this.options.maxStakeFraction, Math.max(0.0001, fraction));
    }
    winPnl(target, stake) {
        const sectorSize = RouletteStats_1.RouletteStats.SECTORS[target]?.length ?? 1;
        const payout = RouletteStats_1.RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1;
        return stake * payout;
    }
    summarize(sampleSize, outcomes) {
        const worstDrawdown = Math.max(...outcomes.map(item => item.maxDrawdown), 0);
        const worstRuinProbability = Math.max(...outcomes.map(item => item.ruinProbability), 0);
        const medianCapitalEfficiency = median(outcomes.map(item => item.capitalEfficiency));
        const maxExposureSaturation = Math.max(...outcomes.map(item => item.maxExposure / this.options.maxStakeFraction), 0);
        const advancedRiskOfRuin = this.advancedRisk(outcomes, worstDrawdown, worstRuinProbability, maxExposureSaturation);
        const circuitBreakers = this.circuitBreakers(outcomes, advancedRiskOfRuin, medianCapitalEfficiency);
        const reviewStatus = this.reviewStatus(circuitBreakers, advancedRiskOfRuin, medianCapitalEfficiency);
        return {
            sampleSize,
            policies: outcomes.length,
            worstDrawdown: round(worstDrawdown),
            worstRuinProbability: round(worstRuinProbability),
            medianCapitalEfficiency: round(medianCapitalEfficiency),
            maxExposureSaturation: round(maxExposureSaturation),
            advancedRiskOfRuin,
            governance: {
                operationalGate: 'BLOCKED',
                reviewStatus,
                circuitBreakers
            }
        };
    }
    advancedRisk(outcomes, worstDrawdown, worstRuinProbability, maxExposureSaturation) {
        const failedPolicies = outcomes.filter(item => item.riskGrade === 'FAIL').length / Math.max(1, outcomes.length);
        const expectedShortfallProxy = average(outcomes.map(item => Math.max(0, 1 - item.finalCapital / this.options.initialCapital)));
        const capitalAtRiskFraction = Math.min(1, worstDrawdown * 0.55 + expectedShortfallProxy * 0.3 + failedPolicies * 0.15);
        const probability = Math.min(1, worstRuinProbability * 0.5 + capitalAtRiskFraction * 0.3 + Math.min(1, maxExposureSaturation) * 0.2);
        const drivers = [];
        if (worstDrawdown > 0.45)
            drivers.push('severe_drawdown');
        if (worstRuinProbability > 0.35)
            drivers.push('high_ruin_probability');
        if (expectedShortfallProxy > 0.25)
            drivers.push('large_expected_shortfall');
        if (maxExposureSaturation > 0.9)
            drivers.push('exposure_saturation');
        if (failedPolicies > 0)
            drivers.push('policy_failure_cluster');
        return {
            probability: round(probability),
            severity: probability >= 0.7 ? 'CRITICAL' : probability >= 0.45 ? 'HIGH' : probability >= 0.22 ? 'MODERATE' : 'LOW',
            drivers,
            capitalAtRiskFraction: round(capitalAtRiskFraction),
            expectedShortfallProxy: round(expectedShortfallProxy),
            exposureSaturation: round(Math.min(1, maxExposureSaturation))
        };
    }
    circuitBreakers(outcomes, risk, medianCapitalEfficiency) {
        const breakers = [];
        if (risk.severity === 'CRITICAL')
            breakers.push('critical_risk_of_ruin');
        if (risk.probability > 0.45)
            breakers.push('ruin_probability_above_governance_limit');
        if (outcomes.some(item => item.maxDrawdown > 0.5))
            breakers.push('capital_drawdown_breach');
        if (outcomes.filter(item => item.riskGrade === 'FAIL').length > 0)
            breakers.push('stake_policy_failure');
        if (outcomes.some(item => item.convexityOfLoss > 0.72))
            breakers.push('convex_loss_profile_detected');
        if (medianCapitalEfficiency < 0.28)
            breakers.push('low_capital_efficiency');
        return [...new Set(breakers)];
    }
    reviewStatus(circuitBreakers, risk, medianCapitalEfficiency) {
        if (circuitBreakers.some(code => ['critical_risk_of_ruin', 'ruin_probability_above_governance_limit', 'capital_drawdown_breach', 'stake_policy_failure'].includes(code)))
            return 'REJECTED';
        if (risk.severity === 'LOW' && medianCapitalEfficiency >= 0.55 && circuitBreakers.length === 0)
            return 'CAPITAL_RESILIENT_CANDIDATE';
        return 'RESEARCH_REVIEW';
    }
    capitalEfficiency(roi, maxDrawdown, averageExposure, longestUnderwaterRun, sampleSize) {
        const drawdownPenalty = Math.min(1, maxDrawdown * 1.35);
        const exposurePenalty = Math.min(1, averageExposure / Math.max(0.0001, this.options.maxStakeFraction));
        const underwaterPenalty = sampleSize <= 0 ? 1 : Math.min(1, longestUnderwaterRun / sampleSize);
        const returnScore = Math.max(0, Math.min(1, 0.5 + roi));
        return Math.max(0, returnScore * 0.45 + (1 - drawdownPenalty) * 0.25 + (1 - exposurePenalty) * 0.15 + (1 - underwaterPenalty) * 0.15);
    }
    ruinProbability(maxDrawdown, ruinEvents, sampleSize, maxExposure, roi) {
        const eventPressure = sampleSize <= 0 ? 1 : ruinEvents / sampleSize;
        const exposurePressure = maxExposure / Math.max(0.0001, this.options.maxStakeFraction);
        const lossPressure = roi < 0 ? Math.min(0.35, Math.abs(roi) * 0.45) : 0;
        return Math.min(1, maxDrawdown * 0.45 + eventPressure * 0.3 + exposurePressure * 0.15 + lossPressure);
    }
    grade(maxDrawdown, ruinProbability, maxExposure, capitalEfficiency, convexityOfLoss) {
        if (maxDrawdown > 0.5 || ruinProbability > 0.45 || maxExposure > this.options.maxStakeFraction * 1.001 || convexityOfLoss > 0.78)
            return 'FAIL';
        if (maxDrawdown > 0.3 || ruinProbability > 0.25 || capitalEfficiency < 0.4 || convexityOfLoss > 0.55)
            return 'WATCH';
        return 'PASS';
    }
}
exports.CapitalExposureSimulator = CapitalExposureSimulator;
function average(values) {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
function round(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(6));
}
