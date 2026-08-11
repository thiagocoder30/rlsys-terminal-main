import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class EntropyPolicy implements PreFlightPolicy {
    public readonly name = 'EntropyPolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        // Shannon Entropy should be sufficiently high to ensure randomness
        if (context.shannonEntropy < 0.6) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Entropia insuficiente: ${context.shannonEntropy.toFixed(3)}. Mercado com anomalias de distribuição.`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
