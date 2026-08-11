import { PreFlightEngine } from './PreFlightEngine';
import { MinimumOperationalVixPolicy } from './policies/MinimumOperationalVixPolicy';
import { EntropyPolicy } from './policies/EntropyPolicy';
import { BurnInPolicy } from './policies/BurnInPolicy';
import { AdaptiveConfidencePolicy } from './policies/AdaptiveConfidencePolicy';
import { ShadowPerformancePolicy } from './policies/ShadowPerformancePolicy';
import { ConsensusPolicy } from './policies/ConsensusPolicy';
import { RiskPolicy } from './policies/RiskPolicy';
import { CooldownPolicy } from './policies/CooldownPolicy';
import { SessionStatePolicy } from './policies/SessionStatePolicy';
import { PreFlightContext } from './PreFlightContext';
import { PreFlightResult } from './PreFlightResult';

export class OperationalGate {
    private readonly engine: PreFlightEngine;

    constructor() {
        const policies = [
            new MinimumOperationalVixPolicy(),
            new EntropyPolicy(),
            new BurnInPolicy(),
            new AdaptiveConfidencePolicy(),
            new ShadowPerformancePolicy(),
            new ConsensusPolicy(),
            new RiskPolicy(),
            new CooldownPolicy(),
            new SessionStatePolicy()
        ];
        this.engine = new PreFlightEngine(policies);
    }

    public executePreFlight(context: PreFlightContext): PreFlightResult {
        return this.engine.evaluate(context);
    }
}
