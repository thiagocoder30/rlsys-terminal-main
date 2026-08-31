export type OperatorRuntimeMode =
  | 'SUPERVISED';


export type OperatorExecutionMode =
  | 'MANUAL_OPERATOR_ONLY';


export interface OperatorRuntimeStatus {
  readonly sessionId: string;
  readonly phase: string;
  readonly roundCount: number;

  readonly operatorMode:
    OperatorRuntimeMode;

  readonly execution:
    OperatorExecutionMode;

  readonly automaticEntry:
    false;
}


export interface OperatorRoundResult {
  readonly accepted: boolean;
  readonly round: number;
  readonly roundCount: number;
  readonly phase: string;
  readonly message: string;
}


export interface OperatorRecommendation {
  readonly available: boolean;

  readonly strategyId?:
    string;

  readonly target?:
    string;

  readonly stake?:
    number;

  readonly confidencePercent?:
    number;

  readonly rationale?:
    string;

  readonly operatorDecisionRequired:
    true;

  readonly supervisedRecommendationOnly:
    true;

  readonly automaticEntry:
    false;
}


export interface OperatorStatusSourcePort {

  getOperatorStatus():
    OperatorRuntimeStatus;

}


export interface ManualRoundIngestionSourcePort {

  ingestRound(
    round: number,
  ): Promise<OperatorRoundResult>;

}


export interface RecommendationSourcePort {

  getLatestRecommendation():
    Promise<OperatorRecommendation>;

}


export interface OperatorRuntimePort {

  getStatus():
    OperatorRuntimeStatus;


  ingestRound(
    round: number,
  ): Promise<OperatorRoundResult>;


  getLatestRecommendation():
    Promise<OperatorRecommendation>;

}
