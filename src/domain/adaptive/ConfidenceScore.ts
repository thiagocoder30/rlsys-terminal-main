export interface ConfidenceScore {
    value: number;
    level: 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
}
