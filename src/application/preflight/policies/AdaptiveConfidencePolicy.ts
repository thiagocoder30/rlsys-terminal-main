import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class AdaptiveConfidencePolicy implements PreFlightPolicy {
    public readonly name = 'AdaptiveConfidencePolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.adaptiveConfidence < 50) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Adaptive Confidence abaixo da margem de segurança (50%): ${context.adaptiveConfidence.toFixed(1)}%.`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
