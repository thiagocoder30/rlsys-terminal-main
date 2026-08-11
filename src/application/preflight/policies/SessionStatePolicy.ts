import { PreFlightContext } from '../PreFlightContext';
import { PreFlightPolicy, PolicyResult } from '../PreFlightPolicy';

export class SessionStatePolicy implements PreFlightPolicy {
    public readonly name = 'SessionStatePolicy';

    public evaluate(context: PreFlightContext): PolicyResult {
        if (context.sessionStatus !== 'ACTIVE' && context.sessionStatus !== 'CREATED') {
            return {
                passed: false,
                reason: {
                    policy: this.name,
                    description: `Sessão não está ATIVA: Status = ${context.sessionStatus}.`,
                    severity: 'CRITICAL'
                }
            };
        }
        return { passed: true };
    }
}
