import { IGovernancePolicy } from '../contracts/IGovernancePolicy';

/**
 * SystemGovernancePolicy
 * Core Institutional Governance.
 * Strictly enforces Paper Trading and blocks any automatic execution.
 */
export class SystemGovernancePolicy implements IGovernancePolicy {
  // Institutional hard constraints
  public readonly PaperOnly: boolean = true;
  public readonly ProductionMoneyAllowed: boolean = false;
  public readonly LiveMoneyAuthorization: boolean = false;
  public readonly AutomaticBetExecutionAllowed: boolean = false;

  constructor() {
    // Ensuring constraints cannot be bypassed at initialization
    Object.freeze(this);
  }

  /**
   * Validates if a proposed execution request complies with the governance policy.
   * Throws an error if any of the safety limits are bypassed.
   * 
   * @throws {Error} if governance validation fails.
   */
  public validateExecutionRequest(): void {
    if (this.AutomaticBetExecutionAllowed) {
      throw new Error("GOVERNANCE_VIOLATION: AutomaticBetExecutionAllowed is strictly forbidden.");
    }
    if (this.ProductionMoneyAllowed || this.LiveMoneyAuthorization || !this.PaperOnly) {
      throw new Error("GOVERNANCE_VIOLATION: Live operations are strictly forbidden in PaperOnly mode.");
    }
  }
}
