export type SessionTimeGuardDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type SessionTimeGuardReason =
  | 'SESSION_TIME_WITHIN_LIMIT'
  | 'SESSION_TIME_APPROACHING_LIMIT'
  | 'SESSION_TIME_LIMIT_REACHED'
  | 'INVALID_SESSION_TIME_INPUT';

export interface SessionTimeGuardPolicy {
  readonly maxSessionMinutes: number;
  readonly warningThresholdMinutes: number;
}

export interface SessionTimeGuardInput {
  readonly sessionStartedAtEpochMs: number;
  readonly evaluatedAtEpochMs: number;
  readonly policy: SessionTimeGuardPolicy;
}

export interface SessionTimeGuardEvaluation {
  readonly decision: SessionTimeGuardDecision;
  readonly reason: SessionTimeGuardReason;
  readonly elapsedMinutes: number;
  readonly remainingMinutes: number;
  readonly productionMoneyAllowed: false;
  readonly explanation: string;
}

export type SessionTimeGuardResult =
  | {
      readonly ok: true;
      readonly value: SessionTimeGuardEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: SessionTimeGuardEvaluation;
    };

const MILLISECONDS_PER_MINUTE = 60_000;

export class SessionTimeGuard {
  public evaluate(input: SessionTimeGuardInput): SessionTimeGuardResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return {
        ok: false,
        error: invalidEvaluation,
      };
    }

    const elapsedMinutes = Math.floor(
      (input.evaluatedAtEpochMs - input.sessionStartedAtEpochMs) /
        MILLISECONDS_PER_MINUTE,
    );

    const remainingMinutes = Math.max(
      0,
      input.policy.maxSessionMinutes - elapsedMinutes,
    );

    if (elapsedMinutes >= input.policy.maxSessionMinutes) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'SESSION_TIME_LIMIT_REACHED',
          elapsedMinutes,
          remainingMinutes,
          productionMoneyAllowed: false,
          explanation:
            'Limite institucional de tempo de sessão atingido. A sessão PAPER deve ser bloqueada para proteger o operador contra fadiga e perda de disciplina.',
        },
      };
    }

    if (elapsedMinutes >= input.policy.warningThresholdMinutes) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'SESSION_TIME_APPROACHING_LIMIT',
          elapsedMinutes,
          remainingMinutes,
          productionMoneyAllowed: false,
          explanation:
            'A sessão está próxima do limite institucional. O sistema recomenda aguardar, reduzir exposição operacional e preparar encerramento supervisionado.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'SESSION_TIME_WITHIN_LIMIT',
        elapsedMinutes,
        remainingMinutes,
        productionMoneyAllowed: false,
        explanation:
          'Tempo de sessão dentro do limite institucional. A avaliação permanece compatível apenas com operação PAPER supervisionada.',
      },
    };
  }

  private validate(input: SessionTimeGuardInput): SessionTimeGuardEvaluation | null {
    const invalidPolicy =
      !Number.isFinite(input.policy.maxSessionMinutes) ||
      !Number.isFinite(input.policy.warningThresholdMinutes) ||
      input.policy.maxSessionMinutes <= 0 ||
      input.policy.warningThresholdMinutes < 0 ||
      input.policy.warningThresholdMinutes > input.policy.maxSessionMinutes;

    const invalidTime =
      !Number.isFinite(input.sessionStartedAtEpochMs) ||
      !Number.isFinite(input.evaluatedAtEpochMs) ||
      input.sessionStartedAtEpochMs < 0 ||
      input.evaluatedAtEpochMs < input.sessionStartedAtEpochMs;

    if (!invalidPolicy && !invalidTime) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_SESSION_TIME_INPUT',
      elapsedMinutes: 0,
      remainingMinutes: 0,
      productionMoneyAllowed: false,
      explanation:
        'Entrada inválida para análise institucional de tempo de sessão. O sistema bloqueia a utilização por segurança operacional.',
    };
  }
}
