import {
  BankrollSafetyGate,
  BankrollSafetyGateResult,
  ConsciousProfitModeEngine,
  ConsciousProfitModeResult,
  OperatorRiskProfile,
} from '../../domain/risk';
import {
  OperatorGuidanceMessage,
  OperatorGuidanceMessageComposer,
} from '../../domain/operator';
import {
  RuntimeCooldownCommandGate,
  RuntimeCooldownCommandType,
  RuntimeCooldownCommandResult,
} from './RuntimeCooldownCommandGate';

export type RuntimeRiskDecisionVerdict =
  | 'RISK_ALLOW'
  | 'RISK_REVIEW'
  | 'RISK_BLOCK';

export interface RuntimeRiskDecisionInput {
  readonly profile: OperatorRiskProfile;
  readonly commandType: RuntimeCooldownCommandType;
  readonly currentBalance: number;
  readonly requestedStake: number;
  readonly currentSessionPnl: number;
  readonly martingaleStep: number;
  readonly nowEpochMs: number;
}

export interface RuntimeRiskDecisionResult {
  readonly verdict: RuntimeRiskDecisionVerdict;
  readonly bankroll: BankrollSafetyGateResult;
  readonly profit: ConsciousProfitModeResult;
  readonly cooldown: RuntimeCooldownCommandResult;
  readonly guidance: OperatorGuidanceMessage;
  readonly reason: string;
}

/**
 * Application-level risk gateway for operator-safe runtime decisions.
 *
 * It composes bankroll safety, conscious profit protection, emotional cooldown,
 * and human guidance without coupling these domains to RuntimeKernel internals.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeRiskDecisionGateway {
  public constructor(
    private readonly bankrollGate: BankrollSafetyGate = new BankrollSafetyGate(),
    private readonly profitMode: ConsciousProfitModeEngine = new ConsciousProfitModeEngine(),
    private readonly cooldownGate: RuntimeCooldownCommandGate = new RuntimeCooldownCommandGate(),
    private readonly guidanceComposer: OperatorGuidanceMessageComposer =
      new OperatorGuidanceMessageComposer(),
  ) {}

  public evaluate(input: RuntimeRiskDecisionInput): RuntimeRiskDecisionResult {
    this.assertValidInput(input);

    const cooldown = this.cooldownGate.evaluate({
      commandType: input.commandType,
      nowEpochMs: input.nowEpochMs,
    });

    const bankroll = this.bankrollGate.evaluate({
      profile: input.profile,
      currentBalance: input.currentBalance,
      requestedStake: input.requestedStake,
      currentSessionPnl: input.currentSessionPnl,
      martingaleStep: input.martingaleStep,
    });

    const profit = this.profitMode.evaluate({
      profile: input.profile,
      currentSessionPnl: input.currentSessionPnl,
    });

    const guidance = this.guidanceComposer.compose(bankroll);

    if (cooldown.verdict === 'BLOCK') {
      return {
        verdict: 'RISK_BLOCK',
        bankroll,
        profit,
        cooldown,
        guidance,
        reason: cooldown.reason,
      };
    }

    if (bankroll.verdict === 'BLOCKED') {
      return {
        verdict: 'RISK_BLOCK',
        bankroll,
        profit,
        cooldown,
        guidance,
        reason: bankroll.reason,
      };
    }

    if (profit.state === 'PROFIT_LOCKED') {
      return {
        verdict: 'RISK_BLOCK',
        bankroll,
        profit,
        cooldown,
        guidance,
        reason: profit.reason,
      };
    }

    if (
      cooldown.verdict === 'REVIEW' ||
      bankroll.verdict === 'REVIEW' ||
      profit.state === 'PROFIT_PROTECT'
    ) {
      return {
        verdict: 'RISK_REVIEW',
        bankroll,
        profit,
        cooldown,
        guidance,
        reason: this.reviewReason(bankroll, profit, cooldown),
      };
    }

    return {
      verdict: 'RISK_ALLOW',
      bankroll,
      profit,
      cooldown,
      guidance,
      reason: 'Operação compatível com o perfil de risco e sem alerta emocional ativo.',
    };
  }

  private reviewReason(
    bankroll: BankrollSafetyGateResult,
    profit: ConsciousProfitModeResult,
    cooldown: RuntimeCooldownCommandResult,
  ): string {
    if (cooldown.verdict === 'REVIEW') {
      return cooldown.reason;
    }

    if (profit.state === 'PROFIT_PROTECT') {
      return profit.reason;
    }

    return bankroll.reason;
  }

  private assertValidInput(input: RuntimeRiskDecisionInput): void {
    if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) {
      throw new Error('currentBalance must be a non-negative finite number');
    }

    if (!Number.isFinite(input.requestedStake) || input.requestedStake <= 0) {
      throw new Error('requestedStake must be a positive finite number');
    }

    if (!Number.isFinite(input.currentSessionPnl)) {
      throw new Error('currentSessionPnl must be finite');
    }

    if (!Number.isInteger(input.martingaleStep) || input.martingaleStep < 0) {
      throw new Error('martingaleStep must be a non-negative integer');
    }

    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      throw new Error('nowEpochMs must be a positive integer');
    }
  }
}
