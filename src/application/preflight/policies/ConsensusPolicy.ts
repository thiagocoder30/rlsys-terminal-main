import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class ConsensusPolicy implements PreFlightPolicy {
    public readonly name = 'ConsensusPolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.consensusRate < 50) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Ensemble Consensus insuficiente: ${context.consensusRate.toFixed(1)}%. Risco de predição conflitante.`,
                    severity: 'WARNING'
                }
            };
        }
        return { passed: true };
    }
}
