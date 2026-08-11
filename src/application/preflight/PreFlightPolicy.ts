import { PreFlightContext } from './PreFlightContext';
import { PreFlightReason } from './PreFlightReason';

export interface PolicyResult {
    passed: boolean;
    reason?: PreFlightReason;
}

export interface PreFlightPolicy {
    readonly name: string;
    evaluate(context: PreFlightContext): PolicyResult;
}
