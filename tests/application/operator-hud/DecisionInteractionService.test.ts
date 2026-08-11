import { describe, it, expect } from 'vitest';
import { DecisionInteractionService } from '../../../src/application/operator-hud/DecisionInteractionService';
import { SuggestionHistory } from '../../../src/application/operator-hud/SuggestionHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';

describe('DecisionInteractionService', () => {
    it('should confirm and skip suggestions correctly', () => {
        const eventBus = new ObservabilityEventBus();
        const history = new SuggestionHistory();
        const service = new DecisionInteractionService(eventBus, history);

        let confirmedEventFired = false;
        let skippedEventFired = false;

        eventBus.subscribe('SUGGESTION_CONFIRMED', () => { confirmedEventFired = true; });
        eventBus.subscribe('SUGGESTION_SKIPPED', () => { skippedEventFired = true; });

        service.confirmSuggestion('session-1', 1, 'Dozen 1', 5);
        service.skipSuggestion('session-1', 2, 'Dozen 2', 5);

        const records = history.getRecords();
        expect(records.length).toBe(2);
        expect(records[0].action).toBe('CONFIRMED');
        expect(records[1].action).toBe('SKIPPED');
        expect(confirmedEventFired).toBe(true);
        expect(skippedEventFired).toBe(true);
    });
});
