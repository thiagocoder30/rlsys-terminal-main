export interface EnforcementContext {
  readonly consecutiveLosses: number;
  readonly roundsSinceLastAction: number;
}

export interface EnforcementResult {
  readonly isAllowed: boolean;
  readonly state: 'ALLOW' | 'REVIEW' | 'FREEZE' | 'LOCKED';
  readonly reason: string;
}

export class RuntimeEnforcementOrchestrator {
  private readonly MAX_CONSECUTIVE_LOSSES = 3;
  private readonly COOLDOWN_ROUNDS_REQUIRED = 5;

  public evaluateContext(context: EnforcementContext): EnforcementResult {
    // 1. Drawdown Lock (Risco Financeiro Virtual)
    if (context.consecutiveLosses >= this.MAX_CONSECUTIVE_LOSSES) {
      if (context.roundsSinceLastAction < this.COOLDOWN_ROUNDS_REQUIRED) {
        const remaining = this.COOLDOWN_ROUNDS_REQUIRED - context.roundsSinceLastAction;
        return Object.freeze({
          isAllowed: false,
          state: 'LOCKED',
          reason: `[DEFENSE LOCK] Drawdown de segurança atingido (${context.consecutiveLosses} perdas). Aguarde ${remaining} rodadas de resfriamento.`
        });
      } else {
        // Se já cumpriu o cooldown, volta para estado de Review/Allow
        return Object.freeze({
          isAllowed: true,
          state: 'REVIEW',
          reason: `[REVIEW] Cooldown concluído. Operação liberada sob observação estrita.`
        });
      }
    }

    return Object.freeze({
      isAllowed: true,
      state: 'ALLOW',
      reason: 'Condições operacionais dentro do limite de segurança.'
    });
  }
}
