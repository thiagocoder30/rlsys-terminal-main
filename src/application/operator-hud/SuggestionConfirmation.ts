export interface SuggestionConfirmation {
    suggestionId: string;
    sessionId: string;
    roundId: number;
    timestamp: number;
    strategy: string;
    stake: number;
    action: 'CONFIRMED' | 'SKIPPED';
}
