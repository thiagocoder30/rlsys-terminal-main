import { TacticalExecutionRequest } from './TacticalExecutionRequest';
import { IntelligenceExecutionResult } from '../result/IntelligenceExecutionResult';

export interface TacticalEnginePort {
    execute(request: TacticalExecutionRequest): Promise<IntelligenceExecutionResult>;
}
