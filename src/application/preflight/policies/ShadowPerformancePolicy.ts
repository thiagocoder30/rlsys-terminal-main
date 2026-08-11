import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class ShadowPerformancePolicy implements PreFlightPolicy {
    public readonly name = 'ShadowPerformancePolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.shadowPerformance < 30) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Shadow Performance crítica: ${context.shadowPerformance.toFixed(1)}%. Modelos falhando em paper mode.`,
                    severity: 'WARNING'
                }
            };
        }
        return { passed: true };
    }
}
