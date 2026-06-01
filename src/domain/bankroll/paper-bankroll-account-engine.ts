export type PaperBankrollAccountStatus = 'ACTIVE' | 'BLOCKED';

export type PaperBankrollAccountReason =
  | 'PAPER_BANKROLL_ACCOUNT_CREATED'
  | 'PAPER_BANKROLL_ACCOUNT_REPLAYED_IDEMPOTENTLY'
  | 'INVALID_PAPER_BANKROLL_INPUT'
  | 'LIVE_MONEY_FORBIDDEN'
  | 'ACCOUNT_ID_MISMATCH'
  | 'NON_IDEMPOTENT_ACCOUNT_REPLAY_REJECTED';

export interface PaperBankrollAccountInput {
  readonly accountId: string;
  readonly initialBalance: number;
  readonly currency: 'PAPER_BRL' | 'PAPER_UNIT';
  readonly createdAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperBankrollAccountSnapshot {
  readonly accountId: string;
  readonly currency: 'PAPER_BRL' | 'PAPER_UNIT';
  readonly initialBalance: number;
  readonly currentBalance: number;
  readonly reservedBalance: number;
  readonly availableBalance: number;
  readonly realizedPnL: number;
  readonly status: PaperBankrollAccountStatus;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly createdAtEpochMs: number;
  readonly updatedAtEpochMs: number;
  readonly version: 1;
}

export interface PaperBankrollAccountEvaluation {
  readonly reason: PaperBankrollAccountReason;
  readonly account: PaperBankrollAccountSnapshot;
  readonly explanation: string;
}

export type PaperBankrollAccountResult =
  | {
      readonly ok: true;
      readonly value: PaperBankrollAccountEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperBankrollAccountReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperBankrollAccountEngine
 *
 * Serviço de domínio responsável por criar a conta institucional de banca
 * fictícia usada pelo modo Paper Trading do RL.SYS CORE.
 *
 * Invariantes:
 * - Nunca autoriza dinheiro real.
 * - Toda conta nasce com productionMoneyAllowed=false.
 * - Toda criação repetida precisa ser idempotente.
 * - Operação O(1) em tempo e memória.
 */
export class PaperBankrollAccountEngine {
  public createAccount(
    input: PaperBankrollAccountInput,
    previousAccount?: PaperBankrollAccountSnapshot,
  ): PaperBankrollAccountResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_BANKROLL_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail(
        'LIVE_MONEY_FORBIDDEN',
        'Paper bankroll account cannot be created when live money flags are enabled.',
      );
    }

    const initialBalance = this.roundMoney(input.initialBalance);

    if (previousAccount !== undefined) {
      return this.replayAccountCreation(input, previousAccount, initialBalance);
    }

    const account: PaperBankrollAccountSnapshot = Object.freeze({
      accountId: input.accountId,
      currency: input.currency,
      initialBalance,
      currentBalance: initialBalance,
      reservedBalance: 0,
      availableBalance: initialBalance,
      realizedPnL: 0,
      status: 'ACTIVE',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      createdAtEpochMs: input.createdAtEpochMs,
      updatedAtEpochMs: input.createdAtEpochMs,
      version: 1,
    });

    return {
      ok: true,
      value: {
        reason: 'PAPER_BANKROLL_ACCOUNT_CREATED',
        account,
        explanation:
          'Conta de banca fictícia PAPER criada com saldo inicial auditável. Dinheiro real permanece bloqueado por invariante de domínio.',
      },
    };
  }

  private replayAccountCreation(
    input: PaperBankrollAccountInput,
    previousAccount: PaperBankrollAccountSnapshot,
    initialBalance: number,
  ): PaperBankrollAccountResult {
    if (previousAccount.accountId !== input.accountId) {
      return this.fail(
        'ACCOUNT_ID_MISMATCH',
        'Existing paper bankroll account id does not match the requested account id.',
      );
    }

    const sameImmutableFields =
      previousAccount.initialBalance === initialBalance &&
      previousAccount.currency === input.currency &&
      previousAccount.createdAtEpochMs === input.createdAtEpochMs &&
      previousAccount.productionMoneyAllowed === false &&
      previousAccount.liveMoneyAuthorization === false;

    if (!sameImmutableFields) {
      return this.fail(
        'NON_IDEMPOTENT_ACCOUNT_REPLAY_REJECTED',
        'Repeated paper bankroll creation must preserve immutable account fields.',
      );
    }

    return {
      ok: true,
      value: {
        reason: 'PAPER_BANKROLL_ACCOUNT_REPLAYED_IDEMPOTENTLY',
        account: previousAccount,
        explanation:
          'Criação repetida da mesma banca fictícia PAPER detectada como replay idempotente. Nenhum saldo foi alterado.',
      },
    };
  }

  private validateInput(input: PaperBankrollAccountInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!/^[0-9A-Za-z._:-]{3,80}$/.test(input.accountId)) {
      return 'accountId must be a safe token with 3 to 80 characters.';
    }

    if (input.currency !== 'PAPER_BRL' && input.currency !== 'PAPER_UNIT') {
      return 'currency must be PAPER_BRL or PAPER_UNIT.';
    }

    if (!Number.isFinite(input.initialBalance) || input.initialBalance <= 0) {
      return 'initialBalance must be a positive finite number.';
    }

    if (!Number.isInteger(input.createdAtEpochMs) || input.createdAtEpochMs <= 0) {
      return 'createdAtEpochMs must be a positive integer.';
    }

    return null;
  }

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }

  private fail(reason: PaperBankrollAccountReason, message: string): PaperBankrollAccountResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
