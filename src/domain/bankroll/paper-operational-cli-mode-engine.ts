import { PaperBankrollAccountEngine } from './paper-bankroll-account-engine';
import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import { PaperRiskGuardAggregator } from './paper-risk-guard-aggregator';
import type { PaperRiskGuardEvaluation } from './paper-risk-guard-aggregator';
import { PaperSessionCoordinator } from './paper-session-coordinator';
import { PaperSessionJournalEngine } from './paper-session-journal-engine';
import type { PaperSessionJournalSnapshot } from './paper-session-journal-engine';
import { PaperSessionRecoveryEngine } from './paper-session-recovery-engine';
import { PaperSessionSnapshotEngine } from './paper-session-snapshot-engine';
import type { PaperSessionSnapshot } from './paper-session-snapshot-engine';
import { PaperStakePolicyEngine } from './paper-stake-policy-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';
import type { PaperTradeEntryRecord } from './paper-trade-lifecycle-engine';

export type PaperOperationalCliCommand =
  | 'help'
  | 'status'
  | 'prepare'
  | 'open-paper'
  | 'settle-win'
  | 'settle-loss'
  | 'settle-push'
  | 'snapshot'
  | 'recover'
  | 'finish'
  | 'demo';

export type PaperOperationalCliReason =
  | 'PAPER_CLI_HELP_RENDERED'
  | 'PAPER_CLI_STATUS_RENDERED'
  | 'PAPER_CLI_SESSION_PREPARED'
  | 'PAPER_CLI_ENTRY_OPENED'
  | 'PAPER_CLI_TRADE_SETTLED'
  | 'PAPER_CLI_SNAPSHOT_CREATED'
  | 'PAPER_CLI_RECOVERY_CREATED'
  | 'PAPER_CLI_SESSION_FINISHED'
  | 'PAPER_CLI_DEMO_COMPLETED'
  | 'INVALID_PAPER_CLI_COMMAND'
  | 'INVALID_PAPER_CLI_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperOperationalCliInput {
  readonly command: PaperOperationalCliCommand | string;
  readonly sessionId?: string;
  readonly tradeId?: string;
  readonly suggestionId?: string;
  readonly strategyId?: string;
  readonly balance?: number;
  readonly stake?: number;
  readonly timestamp?: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperOperationalCliResponse {
  readonly command: string;
  readonly reason: PaperOperationalCliReason;
  readonly ok: boolean;
  readonly decision: 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly message: string;
  readonly data: Record<string, unknown>;
}

export type PaperOperationalCliResult =
  | {
      readonly ok: true;
      readonly value: PaperOperationalCliResponse;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalCliReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

interface PaperCliContext {
  readonly sessionId: string;
  readonly tradeId: string;
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly timestamp: number;
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly riskGuard: PaperRiskGuardEvaluation;
  readonly journal: PaperSessionJournalSnapshot;
}

type PaperCliContextResult =
  | {
      readonly ok: true;
      readonly value: PaperCliContext;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalCliReason;
        readonly message: string;
      };
    };

interface PaperCliOpenedTrade extends PaperCliContext {
  readonly entry: PaperTradeEntryRecord;
}

type PaperCliOpenedTradeResult =
  | {
      readonly ok: true;
      readonly value: PaperCliOpenedTrade;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalCliReason;
        readonly message: string;
      };
    };

/**
 * PaperOperationalCliModeEngine
 *
 * Núcleo de domínio para o modo operacional PAPER via CLI. Ele interpreta
 * comandos em memória e chama os motores institucionais existentes.
 *
 * Este motor não lê arquivo, não grava arquivo, não abre aposta, não autoriza
 * dinheiro real e não mantém estado global. Persistência futura deve ser
 * implementada em infraestrutura.
 *
 * Complexidade: O(1) para todos os comandos demonstrativos.
 */
export class PaperOperationalCliModeEngine {
  private readonly bankrollEngine: PaperBankrollAccountEngine;
  private readonly stakePolicyEngine: PaperStakePolicyEngine;
  private readonly riskGuardAggregator: PaperRiskGuardAggregator;
  private readonly sessionCoordinator: PaperSessionCoordinator;
  private readonly journalEngine: PaperSessionJournalEngine;
  private readonly snapshotEngine: PaperSessionSnapshotEngine;
  private readonly recoveryEngine: PaperSessionRecoveryEngine;

  public constructor() {
    this.bankrollEngine = new PaperBankrollAccountEngine();
    this.stakePolicyEngine = new PaperStakePolicyEngine();
    this.riskGuardAggregator = new PaperRiskGuardAggregator();
    this.sessionCoordinator = new PaperSessionCoordinator();
    this.journalEngine = new PaperSessionJournalEngine();
    this.snapshotEngine = new PaperSessionSnapshotEngine();
    this.recoveryEngine = new PaperSessionRecoveryEngine();
  }

  public execute(input: PaperOperationalCliInput): PaperOperationalCliResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper operational CLI cannot run with live money flags enabled.');
    }

    if (!this.isKnownCommand(input.command)) {
      return this.fail('INVALID_PAPER_CLI_COMMAND', `Unknown PAPER CLI command: ${String(input.command)}`);
    }

    if (input.command === 'help') {
      return this.response(input.command, 'PAPER_CLI_HELP_RENDERED', 'PAPER_COMPATIVEL', 'Comandos PAPER disponíveis.', {
        commands: [
          'help',
          'status',
          'prepare',
          'open-paper',
          'settle-win',
          'settle-loss',
          'settle-push',
          'snapshot',
          'recover',
          'finish',
          'demo',
        ],
      });
    }

    if (input.command === 'status') {
      return this.response(input.command, 'PAPER_CLI_STATUS_RENDERED', 'PAPER_COMPATIVEL', 'Modo PAPER operacional disponível.', {
        mode: 'PAPER_OPERATIONAL',
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });
    }

    if (input.command === 'demo') {
      return this.runDemo(input);
    }

    if (input.command === 'prepare') {
      return this.prepare(input);
    }

    if (input.command === 'open-paper') {
      return this.openPaper(input);
    }

    if (input.command === 'settle-win') {
      return this.settle(input, 'WIN');
    }

    if (input.command === 'settle-loss') {
      return this.settle(input, 'LOSS');
    }

    if (input.command === 'settle-push') {
      return this.settle(input, 'PUSH');
    }

    if (input.command === 'snapshot') {
      return this.snapshot(input, 'ACTIVE');
    }

    if (input.command === 'recover') {
      return this.recover(input);
    }

    return this.snapshot(input, 'FINISHED');
  }

  private prepare(input: PaperOperationalCliInput): PaperOperationalCliResult {
    const context = this.createContext(input);

    if (!context.ok) {
      return this.fail(context.error.reason, context.error.message);
    }

    return this.response('prepare', 'PAPER_CLI_SESSION_PREPARED', 'PAPER_COMPATIVEL', 'Sessão PAPER preparada com banca fictícia.', {
      sessionId: context.value.sessionId,
      account: context.value.account,
      journal: context.value.journal,
    });
  }

  private openPaper(input: PaperOperationalCliInput): PaperOperationalCliResult {
    const context = this.createContext(input);

    if (!context.ok) {
      return this.fail(context.error.reason, context.error.message);
    }

    const opened = this.sessionCoordinator.openPaperEntry({
      tradeId: context.value.tradeId,
      suggestionId: context.value.suggestionId,
      strategyId: context.value.strategyId,
      account: context.value.account,
      stake: context.value.stake,
      riskGuard: context.value.riskGuard,
      openedAtEpochMs: context.value.timestamp + 2,
      manualConfirmation: true,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!opened.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', opened.error.message);
    }

    return this.response(
      'open-paper',
      'PAPER_CLI_ENTRY_OPENED',
      opened.value.decision === 'PAPER_ENTRY_OPENED' ? 'PAPER_COMPATIVEL' : 'AGUARDAR',
      opened.value.explanation,
      {
        entry: opened.value.entry,
      },
    );
  }

  private settle(input: PaperOperationalCliInput, outcome: 'WIN' | 'LOSS' | 'PUSH'): PaperOperationalCliResult {
    const opened = this.createOpenedTrade(input);

    if (!opened.ok) {
      return this.fail(opened.error.reason, opened.error.message);
    }

    const settled = this.sessionCoordinator.settlePaperTrade({
      entry: opened.value.entry,
      account: opened.value.account,
      stake: opened.value.stake,
      settlementId: `settlement-${outcome.toLowerCase()}-${opened.value.tradeId}`,
      outcome,
      settledAtEpochMs: opened.value.timestamp + 3,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!settled.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', settled.error.message);
    }

    return this.response(
      `settle-${outcome.toLowerCase()}`,
      'PAPER_CLI_TRADE_SETTLED',
      'PAPER_COMPATIVEL',
      settled.value.explanation,
      {
        settlement: settled.value.settlement,
        final: settled.value.final,
        account: settled.value.account,
      },
    );
  }

  private snapshot(input: PaperOperationalCliInput, state: 'ACTIVE' | 'FINISHED'): PaperOperationalCliResult {
    const context = this.createContext(input);

    if (!context.ok) {
      return this.fail(context.error.reason, context.error.message);
    }

    const snapshot = this.snapshotEngine.compose({
      snapshotId: `snapshot-${context.value.sessionId}-${state.toLowerCase()}`,
      sessionId: context.value.sessionId,
      state,
      account: context.value.account,
      journal: context.value.journal,
      updatedAtEpochMs: context.value.timestamp + 4,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!snapshot.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', snapshot.error.message);
    }

    return this.response(
      state === 'FINISHED' ? 'finish' : 'snapshot',
      state === 'FINISHED' ? 'PAPER_CLI_SESSION_FINISHED' : 'PAPER_CLI_SNAPSHOT_CREATED',
      'PAPER_COMPATIVEL',
      snapshot.value.explanation,
      {
        snapshot: snapshot.value.snapshot,
      },
    );
  }

  private recover(input: PaperOperationalCliInput): PaperOperationalCliResult {
    const context = this.createContext(input);

    if (!context.ok) {
      return this.fail(context.error.reason, context.error.message);
    }

    const snapshot = this.snapshotEngine.compose({
      snapshotId: `snapshot-recover-${context.value.sessionId}`,
      sessionId: context.value.sessionId,
      state: 'ACTIVE',
      account: context.value.account,
      journal: context.value.journal,
      updatedAtEpochMs: context.value.timestamp + 4,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!snapshot.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', snapshot.error.message);
    }

    const snapshotData: PaperSessionSnapshot = snapshot.value.snapshot;

    const recovered = this.recoveryEngine.recover({
      recoveryId: `recovery-${snapshotData.sessionId}`,
      snapshot: snapshotData,
      recoveredAtEpochMs: context.value.timestamp + 5,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!recovered.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', recovered.error.message);
    }

    return this.response('recover', 'PAPER_CLI_RECOVERY_CREATED', 'PAPER_COMPATIVEL', recovered.value.explanation, {
      recovery: recovered.value.recovery,
    });
  }

  private runDemo(input: PaperOperationalCliInput): PaperOperationalCliResult {
    const opened = this.createOpenedTrade(input);

    if (!opened.ok) {
      return this.fail(opened.error.reason, opened.error.message);
    }

    const settled = this.sessionCoordinator.settlePaperTrade({
      entry: opened.value.entry,
      account: opened.value.account,
      stake: opened.value.stake,
      settlementId: `settlement-demo-${opened.value.tradeId}`,
      outcome: 'WIN',
      settledAtEpochMs: opened.value.timestamp + 3,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!settled.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', settled.error.message);
    }

    const snapshot = this.snapshotEngine.compose({
      snapshotId: `snapshot-demo-${opened.value.sessionId}`,
      sessionId: opened.value.sessionId,
      state: 'SETTLED',
      account: settled.value.account,
      journal: opened.value.journal,
      updatedAtEpochMs: opened.value.timestamp + 4,
      lastEntry: opened.value.entry,
      lastFinal: settled.value.final,
      lastSettlement: settled.value.settlement,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!snapshot.ok) {
      return this.fail('INVALID_PAPER_CLI_INPUT', snapshot.error.message);
    }

    return this.response('demo', 'PAPER_CLI_DEMO_COMPLETED', 'PAPER_COMPATIVEL', 'Demonstração PAPER executada de ponta a ponta.', {
      entry: opened.value.entry,
      settlement: settled.value.settlement,
      final: settled.value.final,
      snapshot: snapshot.value.snapshot,
    });
  }

  private createOpenedTrade(input: PaperOperationalCliInput): PaperCliOpenedTradeResult {
    const context = this.createContext(input);

    if (!context.ok) {
      return context;
    }

    const opened = this.sessionCoordinator.openPaperEntry({
      tradeId: context.value.tradeId,
      suggestionId: context.value.suggestionId,
      strategyId: context.value.strategyId,
      account: context.value.account,
      stake: context.value.stake,
      riskGuard: context.value.riskGuard,
      openedAtEpochMs: context.value.timestamp + 2,
      manualConfirmation: true,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!opened.ok || opened.value.entry === undefined) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: opened.ok ? 'PAPER entry was not opened.' : opened.error.message,
        },
      };
    }

    return {
      ok: true,
      value: {
        ...context.value,
        entry: opened.value.entry,
      },
    };
  }

  private createContext(input: PaperOperationalCliInput): PaperCliContextResult {
    const sessionId = input.sessionId ?? 'paper-session-cli';
    const tradeId = input.tradeId ?? 'paper-trade-cli';
    const suggestionId = input.suggestionId ?? 'paper-suggestion-cli';
    const strategyId = input.strategyId ?? 'triplicacao';
    const timestamp = this.resolveTimestamp(input);
    const balance = input.balance ?? 100;
    const requestedStake = input.stake ?? 5;

    if (!this.isSafeToken(sessionId, 3, 96) || !this.isSafeToken(tradeId, 3, 96)) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: 'sessionId and tradeId must be safe tokens.',
        },
      };
    }

    if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(requestedStake) || requestedStake <= 0) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: 'balance and stake must be positive finite numbers.',
        },
      };
    }

    const accountResult = this.bankrollEngine.createAccount({
      accountId: `account-${sessionId}`,
      initialBalance: balance,
      currency: 'PAPER_BRL',
      createdAtEpochMs: timestamp,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!accountResult.ok) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: accountResult.error.message,
        },
      };
    }

    const account = accountResult.value.account;

    const stakeResult = this.stakePolicyEngine.evaluate({
      account,
      policy: {
        minStake: 1,
        defaultStake: Math.min(3, Math.max(1, requestedStake)),
        maxStake: 5,
        maxStakePercentOfAvailableBalance: 0.05,
        maxSessionExposure: 12,
      },
      requestedStake,
      currentSessionExposure: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!stakeResult.ok) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: stakeResult.error.message,
        },
      };
    }

    const riskGuardResult = this.riskGuardAggregator.evaluate({
      account,
      stake: stakeResult.value,
      operatorReady: true,
      cooldownActive: false,
      currentSessionExposure: 0,
      maxSessionExposure: 12,
      currentDailyLoss: 0,
      maxDailyLoss: 5,
      currentDrawdown: 0,
      maxDrawdown: 10,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!riskGuardResult.ok) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: riskGuardResult.error.message,
        },
      };
    }

    const journalResult = this.journalEngine.append({
      sessionId,
      eventId: `event-start-${sessionId}`,
      type: 'SESSION_STARTED',
      occurredAtEpochMs: timestamp + 1,
      summary: 'Sessão PAPER iniciada via CLI.',
      maxEvents: 32,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!journalResult.ok) {
      return {
        ok: false,
        error: {
          reason: 'INVALID_PAPER_CLI_INPUT',
          message: journalResult.error.message,
        },
      };
    }

    return {
      ok: true,
      value: {
        sessionId,
        tradeId,
        suggestionId,
        strategyId,
        timestamp,
        account,
        stake: stakeResult.value,
        riskGuard: riskGuardResult.value,
        journal: journalResult.value.journal,
      },
    };
  }

  private response(
    command: string,
    reason: PaperOperationalCliReason,
    decision: 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR',
    message: string,
    data: Record<string, unknown>,
  ): PaperOperationalCliResult {
    return {
      ok: true,
      value: {
        command,
        reason,
        ok: true,
        decision,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        message,
        data,
      },
    };
  }

  private fail(reason: PaperOperationalCliReason, message: string): PaperOperationalCliResult {
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

  private resolveTimestamp(input: PaperOperationalCliInput): number {
    return Number.isInteger(input.timestamp) && Number(input.timestamp) > 0
      ? Number(input.timestamp)
      : 1717200000000;
  }

  private isKnownCommand(command: string): command is PaperOperationalCliCommand {
    return (
      command === 'help' ||
      command === 'status' ||
      command === 'prepare' ||
      command === 'open-paper' ||
      command === 'settle-win' ||
      command === 'settle-loss' ||
      command === 'settle-push' ||
      command === 'snapshot' ||
      command === 'recover' ||
      command === 'finish' ||
      command === 'demo'
    );
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }
}
