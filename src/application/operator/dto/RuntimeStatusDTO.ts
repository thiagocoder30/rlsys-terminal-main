export interface RuntimeStatusDTO {
    status: 'APPROVED' | 'REJECTED';
    reason: string | null;
    paperTrading: boolean;
    operationalVix: number;
    shannonEntropy: number;
    burnIn: number;
    adaptiveConfidence: number;
    shadowPerformance: number;
    consensusRate: number;
    riskLevel: string;
}
