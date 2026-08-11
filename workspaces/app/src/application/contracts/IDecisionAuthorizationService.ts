export type DecisionAuthorizationResult = 'AUTHORIZED' | 'BLOCKED';

export interface DecisionRequest {
  readonly requestedAction: string;
  readonly isLiveMoney: boolean;
  readonly currentDrawdown: number;
  readonly currentProfit: number;
}

export interface IDecisionAuthorizationService {
  authorize(request: DecisionRequest): DecisionAuthorizationResult;
}
