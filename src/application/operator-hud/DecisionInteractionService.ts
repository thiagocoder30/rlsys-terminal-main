import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { SuggestionHistory } from './SuggestionHistory';
import { SuggestionConfirmation } from './SuggestionConfirmation';
import { randomUUID } from 'crypto';

export class DecisionInteractionService {
    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly suggestionHistory: SuggestionHistory
    ) {}

    public confirmSuggestion(
        sessionId: string,
        roundId: number,
        strategy: string,
        stake: number,
        suggestionId: string = randomUUID()
    ): void {
        const confirmation: SuggestionConfirmation = {
            suggestionId,
            sessionId,
            roundId,
            timestamp: Date.now(),
            strategy,
            stake,
            action: 'CONFIRMED'
        };

        this.suggestionHistory.append(confirmation);

        this.eventBus.publish(
            'SUGGESTION_CONFIRMED',
            '5.0.0',
            randomUUID(),
            sessionId,
            { confirmation }
        );
    }

    public skipSuggestion(
        sessionId: string,
        roundId: number,
        strategy: string,
        stake: number,
        suggestionId: string = randomUUID()
    ): void {
        const skip: SuggestionConfirmation = {
            suggestionId,
            sessionId,
            roundId,
            timestamp: Date.now(),
            strategy,
            stake,
            action: 'SKIPPED'
        };

        this.suggestionHistory.append(skip);

        this.eventBus.publish(
            'SUGGESTION_SKIPPED',
            '5.0.0',
            randomUUID(),
            sessionId,
            { confirmation: skip }
        );
    }
}
