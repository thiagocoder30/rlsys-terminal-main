import { InstitutionalMemoryRepository } from './institutional-memory-repository';
import { SessionLearningEngine } from './session-learning-engine';
import type { SessionLearningInput, SessionLearningReport } from './session-learning-engine';

export type SessionLearningRepositoryAdapterReason =
  | 'SESSION_LEARNING_REPOSITORY_ADAPTER_OK'
  | 'INVALID_SESSION_LEARNING_REPOSITORY_INPUT'
  | 'SESSION_LEARNING_REPOSITORY_FAILED'
  | 'LIVE_MONEY_FORBIDDEN';

export interface SessionLearningRepositoryAdapterInput extends SessionLearningInput {
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface SessionLearningRepositoryAdapterReport {
  readonly learning: SessionLearningReport;
  readonly savedSessionId: string;
  readonly savedStrategyIndex: string;
  readonly savedTableIndex: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type SessionLearningRepositoryAdapterResult =
  | {
      readonly ok: true;
      readonly value: SessionLearningRepositoryAdapterReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: SessionLearningRepositoryAdapterReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * SessionLearningRepositoryAdapter
 *
 * Fecha o ciclo institucional:
 * sessão finalizada -> aprendizado -> persistência no laboratório.
 *
 * Orquestra SessionLearningEngine e InstitutionalMemoryRepository sem misturar
 * regra de domínio com I/O. Mantém execução manual, PAPER only e live money
 * permanentemente bloqueado.
 */
export class SessionLearningRepositoryAdapter {
  private readonly learningEngine: SessionLearningEngine;
  private readonly repository: InstitutionalMemoryRepository;

  public constructor(
    repository: InstitutionalMemoryRepository,
    learningEngine: SessionLearningEngine = new SessionLearningEngine(),
  ) {
    this.repository = repository;
    this.learningEngine = learningEngine;
  }

  public async learnAndPersist(
    input: SessionLearningRepositoryAdapterInput,
  ): Promise<SessionLearningRepositoryAdapterResult> {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Learning repository adapter cannot run with live money flags enabled.');
    }

    const learning = this.learningEngine.analyze({
      ...input,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!learning.ok) {
      return this.fail('INVALID_SESSION_LEARNING_REPOSITORY_INPUT', learning.error.message);
    }

    const savedSession = await this.repository.saveSession(learning.value.sessionRecord);

    if (!savedSession.ok) {
      return this.fail('SESSION_LEARNING_REPOSITORY_FAILED', savedSession.error.message);
    }

    const strategyIndexName = this.indexName(learning.value.strategyIndex.key);
    const savedStrategyIndex = await this.repository.saveIndex(strategyIndexName, learning.value.strategyIndex);

    if (!savedStrategyIndex.ok) {
      return this.fail('SESSION_LEARNING_REPOSITORY_FAILED', savedStrategyIndex.error.message);
    }

    const tableIndexName = this.indexName(learning.value.tableIndex.key);
    const savedTableIndex = await this.repository.saveIndex(tableIndexName, learning.value.tableIndex);

    if (!savedTableIndex.ok) {
      return this.fail('SESSION_LEARNING_REPOSITORY_FAILED', savedTableIndex.error.message);
    }

    return {
      ok: true,
      value: {
        learning: learning.value,
        savedSessionId: savedSession.value.sessionId,
        savedStrategyIndex: strategyIndexName,
        savedTableIndex: tableIndexName,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private indexName(key: string): string {
    return key.replace(/[^0-9A-Za-z._:-]/g, '-').replace(/:/g, '-');
  }

  private fail(
    reason: SessionLearningRepositoryAdapterReason,
    message: string,
  ): SessionLearningRepositoryAdapterResult {
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
