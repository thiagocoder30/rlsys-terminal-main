import { describe, it, expect } from 'vitest';
import { SessionTimeline } from '../../../src/application/operator/SessionTimeline';
import { SessionStatistics } from '../../../src/application/operator/SessionStatistics';
import { RecommendationHistory } from '../../../src/application/operator/RecommendationHistory';

describe('SessionTimeline', () => {
    it('appends entries in immutable order', () => {
        const timeline = new SessionTimeline();
        expect(timeline.count).toBe(0);

        timeline.addEntry({
            spinNumber: 1,
            drawnNumber: 17,
            timestampUtc: new Date().toISOString(),
            operationalVix: 22.4,
            entropy: 0.94,
            consensus: 0.85,
            suggestedStrategy: 'STRAT_MARKOV_01',
            stake: 10,
            status: 'RECOMMENDATION',
            processingTimeMs: 12
        });

        expect(timeline.count).toBe(1);
        expect(timeline.getLatest()?.drawnNumber).toBe(17);
        expect(timeline.getEntries()[0].suggestedStrategy).toBe('STRAT_MARKOV_01');
    });
});

describe('SessionStatistics', () => {
    it('calculates running stats in O(1)', () => {
        const stats = new SessionStatistics(1000);

        stats.recordSpin({
            drawnNumber: 17,
            operationalVix: 20,
            entropy: 0.9,
            consensus: 0.8,
            status: 'RECOMMENDATION',
            stake: 10,
            currentBankroll: 1020,
            pnlDelta: 20,
            confidence: 0.85
        });

        const dto = stats.getStatistics();
        expect(dto.totalSpins).toBe(1);
        expect(dto.totalRecommendations).toBe(1);
        expect(dto.shadowPnL).toBe(20);
        expect(dto.currentBankroll).toBe(1020);
        expect(dto.drawdown).toBe(0);
    });
});

describe('RecommendationHistory', () => {
    it('maintains a maximum capacity of 100 items', () => {
        const history = new RecommendationHistory();

        for (let i = 1; i <= 105; i++) {
            history.add({
                id: `REC-${i}`,
                spinNumber: i,
                drawnNumber: i % 37,
                strategy: 'STRAT_TEST',
                stake: 10,
                isOpportunity: true,
                confidence: 0.8,
                consensus: 0.75,
                vix: 20,
                entropy: 0.9,
                explanation: 'Test',
                status: 'RECOMMENDATION',
                timestampUtc: new Date().toISOString()
            });
        }

        expect(history.count).toBe(100);
        expect(history.getLatest()?.spinNumber).toBe(105);
        expect(history.getHistory()[0].spinNumber).toBe(6);
    });
});
