import { TacticalExecutionRequest } from '../dto/TacticalExecutionRequest';
import { IntelligenceExecutionResult } from '../dto/IntelligenceExecutionResult';

export interface TacticalEnginePort {
    processRound(request: TacticalExecutionRequest): Promise<IntelligenceExecutionResult>;
    syncTape(numbers: number[]): Promise<IntelligenceExecutionResult>;
}
