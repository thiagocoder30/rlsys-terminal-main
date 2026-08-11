import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class BurnInPolicy implements PreFlightPolicy {
    public readonly name = 'BurnInPolicy';
    private readonly MIN_BURN_IN = 36;

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.burnInCount < this.MIN_BURN_IN) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Burn-In incompleto: ${context.burnInCount}/${this.MIN_BURN_IN}.`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
