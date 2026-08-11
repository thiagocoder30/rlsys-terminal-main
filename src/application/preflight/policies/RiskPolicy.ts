import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class RiskPolicy implements PreFlightPolicy {
    public readonly name = 'RiskPolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.drawdown > 15) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Hard-Stop de Risco atingido: Drawdown de ${context.drawdown.toFixed(1)}% > 15%.`,
                    severity: 'CRITICAL'
                }
            };
        }
        if (context.currentBankroll <= 0) {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Banca esgotada: $${context.currentBankroll.toFixed(2)}.`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
