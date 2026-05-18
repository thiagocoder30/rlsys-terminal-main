"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestEngine = void 0;
const RouletteStats_1 = require("./RouletteStats");
const StrategyEngine_1 = require("./StrategyEngine");
class BacktestEngine {
    constructor(engineOptions = {}, initialEquity = 1) {
        this.engineOptions = engineOptions;
        this.initialEquity = initialEquity;
        this.stats = new RouletteStats_1.RouletteStats();
    }
    runWalkForward(history) {
        const minSampleSize = this.engineOptions.minSampleSize ?? 120;
        const engine = new StrategyEngine_1.StrategyEngine(this.engineOptions);
        const trades = [];
        let equity = this.initialEquity;
        let peak = equity;
        let maxDrawdown = 0;
        for (let i = minSampleSize; i < history.length - 1; i++) {
            const trainingWindow = history.slice(0, i);
            const decision = engine.analyze(trainingWindow);
            if (!decision || decision.status !== 'ALLOWED' || decision.signals.length === 0)
                continue;
            const primarySignal = decision.signals[0];
            const nextNumber = history[i + 1];
            const nextSector = this.stats.sectorOf(nextNumber);
            const won = nextSector === primarySignal.target;
            const stakeFraction = decision.suggestedFraction;
            const sectorSize = primarySignal.target === 'unknown' ? 0 : RouletteStats_1.RouletteStats.SECTORS[primarySignal.target]?.length ?? 0;
            const fairPayoutProxy = sectorSize > 0 ? RouletteStats_1.RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1 : 0;
            const pnl = won ? stakeFraction * fairPayoutProxy : -stakeFraction;
            equity *= 1 + pnl;
            peak = Math.max(peak, equity);
            maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
            trades.push({
                index: i + 1,
                target: primarySignal.target,
                stakeFraction,
                won,
                payout: pnl,
                equity
            });
        }
        const wins = trades.filter(trade => trade.won).length;
        const losses = trades.length - wins;
        const roi = equity / this.initialEquity - 1;
        const expectancyPerTrade = trades.length === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.payout, 0) / trades.length;
        return {
            summary: {
                trades: trades.length,
                wins,
                losses,
                hitRate: trades.length === 0 ? 0 : wins / trades.length,
                roi,
                maxDrawdown,
                expectancyPerTrade,
                finalEquity: equity
            },
            trades
        };
    }
}
exports.BacktestEngine = BacktestEngine;
