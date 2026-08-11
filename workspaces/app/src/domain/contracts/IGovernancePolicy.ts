export interface IGovernancePolicy {
  readonly PaperOnly: boolean;
  readonly ProductionMoneyAllowed: boolean;
  readonly LiveMoneyAuthorization: boolean;
  readonly AutomaticBetExecutionAllowed: boolean;

  validateExecutionRequest(): void;
}
