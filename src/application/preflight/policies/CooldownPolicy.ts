import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class CooldownPolicy implements PreFlightPolicy {
    public readonly name = 'CooldownPolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.isInCooldown) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Sistema em Cooldown (Esfriamento Institucional).`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
