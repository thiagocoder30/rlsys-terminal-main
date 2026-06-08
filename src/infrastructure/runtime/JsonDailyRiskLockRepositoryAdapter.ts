import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  PersistentDailyBankrollRiskLockSnapshot,
} from '../../application/runtime/PersistentDailyBankrollRiskLock.js';

export interface JsonDailyRiskLockRepositoryAdapterConfig {
  readonly filePath: string;
}

export interface JsonDailyRiskLockRepositoryResult<T> {
  readonly ok: true;
  readonly value: T;
}

export interface JsonDailyRiskLockRepositoryFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'INVALID_DAILY_RISK_LOCK_REPOSITORY_INPUT' | 'DAILY_RISK_LOCK_REPOSITORY_IO_ERROR';
    readonly stage: 'VALIDATION' | 'IO';
    readonly message: string;
  };
}

export type JsonDailyRiskLockRepositoryAdapterResult<T> =
  | JsonDailyRiskLockRepositoryResult<T>
  | JsonDailyRiskLockRepositoryFailure;

/**
 * JSON repository adapter for the daily bankroll risk lock snapshot.
 *
 * This adapter only persists and loads the lock created by
 * PersistentDailyBankrollRiskLock. It does not calculate risk and does not
 * decide stop-win/stop-loss.
 *
 * Writes are atomic: data is written to a temporary file and then renamed.
 *
 * Complexity:
 * - save/load/delete: O(1) for one lock snapshot.
 * - Space: O(1).
 */
export class JsonDailyRiskLockRepositoryAdapter {
  private readonly filePath: string;

  public constructor(config: JsonDailyRiskLockRepositoryAdapterConfig) {
    if (typeof config.filePath !== 'string' || config.filePath.trim().length === 0) {
      throw new Error('filePath is required');
    }

    this.filePath = config.filePath;
  }

  public async save(
    lock: PersistentDailyBankrollRiskLockSnapshot,
  ): Promise<JsonDailyRiskLockRepositoryAdapterResult<PersistentDailyBankrollRiskLockSnapshot>> {
    const validationFailure = this.validateLock(lock);
    if (validationFailure !== null) {
      return validationFailure;
    }

    try {
      await mkdir(dirname(this.filePath), { recursive: true });

      const payload = `${JSON.stringify(lock, null, 2)}\n`;
      const tempPath = `${this.filePath}.tmp`;

      await writeFile(tempPath, payload, 'utf8');
      await rename(tempPath, this.filePath);

      return {
        ok: true,
        value: lock,
      };
    } catch (error: unknown) {
      return this.ioFailure(error);
    }
  }

  public async load(): Promise<JsonDailyRiskLockRepositoryAdapterResult<PersistentDailyBankrollRiskLockSnapshot | null>> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistentDailyBankrollRiskLockSnapshot;

      const validationFailure = this.validateLock(parsed);
      if (validationFailure !== null) {
        return validationFailure;
      }

      return {
        ok: true,
        value: parsed,
      };
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        return {
          ok: true,
          value: null,
        };
      }

      return this.ioFailure(error);
    }
  }

  public async clear(): Promise<JsonDailyRiskLockRepositoryAdapterResult<true>> {
    try {
      await rm(this.filePath, { force: true });
      await rm(`${this.filePath}.tmp`, { force: true });

      return {
        ok: true,
        value: true,
      };
    } catch (error: unknown) {
      return this.ioFailure(error);
    }
  }

  private validateLock(
    lock: PersistentDailyBankrollRiskLockSnapshot,
  ): JsonDailyRiskLockRepositoryFailure | null {
    if (
      typeof lock !== 'object' ||
      lock === null ||
      typeof lock.lockId !== 'string' ||
      lock.lockId.trim().length === 0 ||
      typeof lock.sessionId !== 'string' ||
      lock.sessionId.trim().length === 0 ||
      typeof lock.strategyName !== 'string' ||
      lock.strategyName.trim().length === 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(lock.operationalDay) ||
      (
        lock.reason !== 'STOP_WIN_REACHED' &&
        lock.reason !== 'STOP_LOSS_REACHED' &&
        lock.reason !== 'BANKROLL_BLOCKED'
      ) ||
      !Number.isFinite(lock.lockedAtEpochMs) ||
      !Number.isFinite(lock.unlockAtEpochMs) ||
      lock.unlockAtEpochMs <= lock.lockedAtEpochMs ||
      !Number.isFinite(lock.bankroll) ||
      !Number.isFinite(lock.currentSessionPnl) ||
      !Number.isFinite(lock.stopWinAmount) ||
      !Number.isFinite(lock.stopLossAmount) ||
      typeof lock.bankrollGateVerdict !== 'string' ||
      typeof lock.bankrollGateReason !== 'string' ||
      typeof lock.isActive !== 'boolean' ||
      lock.operatorDecisionRequired !== true ||
      lock.supervisedRecommendationOnly !== true ||
      lock.institutionalAnalysisMode !== true
    ) {
      return {
        ok: false,
        error: {
          code: 'INVALID_DAILY_RISK_LOCK_REPOSITORY_INPUT',
          stage: 'VALIDATION',
          message: 'daily risk lock snapshot is invalid',
        },
      };
    }

    return null;
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { readonly code?: string }).code === 'ENOENT'
    );
  }

  private ioFailure(error: unknown): JsonDailyRiskLockRepositoryFailure {
    return {
      ok: false,
      error: {
        code: 'DAILY_RISK_LOCK_REPOSITORY_IO_ERROR',
        stage: 'IO',
        message: error instanceof Error ? error.message : 'unknown daily risk lock repository IO failure',
      },
    };
  }
}
