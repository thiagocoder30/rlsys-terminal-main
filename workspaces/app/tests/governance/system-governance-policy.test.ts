import { describe, it, expect } from 'vitest';
import { SystemGovernancePolicy } from '../../src/domain/governance/SystemGovernancePolicy';

describe('SystemGovernancePolicy', () => {
  it('should initialize with strictly enforced constraints', () => {
    const policy = new SystemGovernancePolicy();

    expect(policy.PaperOnly).toBe(true);
    expect(policy.ProductionMoneyAllowed).toBe(false);
    expect(policy.LiveMoneyAuthorization).toBe(false);
    expect(policy.AutomaticBetExecutionAllowed).toBe(false);
  });

  it('should be immutable (frozen)', () => {
    const policy = new SystemGovernancePolicy();

    expect(Object.isFrozen(policy)).toBe(true);

    // Attempting to mutate should fail in strict mode or throw
    expect(() => {
      // @ts-ignore
      policy.PaperOnly = false;
    }).toThrow();
  });

  it('should not throw on valid execution request validation', () => {
    const policy = new SystemGovernancePolicy();
    expect(() => policy.validateExecutionRequest()).not.toThrow();
  });
});
