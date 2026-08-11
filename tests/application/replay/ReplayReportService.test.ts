import { describe, it, expect } from 'vitest';
import { ReplayReportService } from '../../../src/application/replay/ReplayReportService';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('ReplayReportService Unit Tests', () => {
    it('should generate replay and store in history', () => {
        const ledger = new DecisionLedger();
        const targetEntry = ledger.append('SESSION-000', '5.0.0', 'RECOMMENDATION_GENERATED', JSON.stringify({ strategy: 'MARTINGALE' }));
        
        const service = new ReplayReportService(ledger);
        
        const replay = service.getReplay(targetEntry.decisionId, 'SESSION-000');
        expect(replay).toBeDefined();
        
        const history = service.getReplayHistory('SESSION-000');
        expect(history).toHaveLength(1);
        expect(history[0].decisionId).toBe(targetEntry.decisionId);
    });
});
