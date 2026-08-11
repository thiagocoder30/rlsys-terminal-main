import { describe, it, expect } from 'vitest';
import { DecisionTimelineBuilder } from '../../../src/application/replay/DecisionTimelineBuilder';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('DecisionTimelineBuilder Unit Tests', () => {
    it('should build timeline in chronological order with correct fields', () => {
        const ledger = new DecisionLedger();
        
        ledger.append('SESSION-000', '5.0.0', 'EVENT_ONE', JSON.stringify({ data: 1 }));
        ledger.append('SESSION-000', '5.0.0', 'EVENT_TWO', JSON.stringify({ data: 2 }));
        
        const builder = new DecisionTimelineBuilder();
        const timeline = builder.build([...ledger.getEntries('SESSION-000')]);
        
        expect(timeline).toHaveLength(2);
        
        expect(timeline[0].event).toBe('EVENT_ONE');
        expect(timeline[0].timestamp).toBeDefined();
        expect(timeline[0].hash).toBeDefined();
        
        expect(timeline[1].event).toBe('EVENT_TWO');
    });
});
