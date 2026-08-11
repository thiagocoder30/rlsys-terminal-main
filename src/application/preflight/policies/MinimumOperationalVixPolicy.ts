import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class MinimumOperationalVixPolicy implements PreFlightPolicy {
    public readonly name = 'MinimumOperationalVixPolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        // Assume VIX should be at least some minimum noise level to avoid flatlining
        if (context.operationalVix < 10) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Operational VIX muito baixo: ${context.operationalVix.toFixed(2)}. Risco de flatline/padrão artificial.`,
                    severity: 'WARNING'
                }
            };
        }
        return { passed: true };
    }
}
