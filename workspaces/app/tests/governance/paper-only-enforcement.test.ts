import { describe, it, expect } from 'vitest';
import { SystemGovernancePolicy } from '../../src/domain/governance/SystemGovernancePolicy';

describe('Paper-Only Enforcement Contract', () => {
  it('must never allow production money in the environment', () => {
    const policy = new SystemGovernancePolicy();
    expect(policy.ProductionMoneyAllowed).toStrictEqual(false);
  });

  it('must strictly require PaperOnly to be true at all times', () => {
    const policy = new SystemGovernancePolicy();
    expect(policy.PaperOnly).toStrictEqual(true);
  });

  it('must block execution if LiveMoneyAuthorization somehow becomes true', () => {
    // This is a theoretical test to ensure the validator catches bypassed state
    const policy = new SystemGovernancePolicy();
    
    // Forcefully bypassing the freeze to simulate an attack or memory manipulation
    const bypassedPolicy = Object.assign({}, policy, { LiveMoneyAuthorization: true }) as SystemGovernancePolicy;
    bypassedPolicy.validateExecutionRequest = policy.validateExecutionRequest.bind(bypassedPolicy);

    expect(() => bypassedPolicy.validateExecutionRequest()).toThrow(/GOVERNANCE_VIOLATION: Live operations are strictly forbidden/);
  });
});
