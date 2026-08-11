export interface PreFlightReason {
    policy: string;
    description: string;
    severity: 'WARNING' | 'CRITICAL';
}
