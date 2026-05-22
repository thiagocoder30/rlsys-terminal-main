import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  OperatorRiskMode,
  OperatorRiskProfile,
} from '../../domain/risk';
import {
  RiskProfileRepository,
  RiskProfileRepositoryLoadResult,
  RiskProfileRepositorySaveResult,
} from '../../domain/risk/RiskProfileRepository';

interface SerializedRiskProfile {
  readonly bankroll: number;
  readonly riskMode: OperatorRiskMode;
  readonly baseStake: number;
  readonly dailyStopWin: number;
  readonly dailyStopLoss: number;
  readonly maxSingleExposure: number;
  readonly maxMartingaleSteps: number;
  readonly recommendedSessionGoal: string;
}

/**
 * JSON file repository for operator risk profile.
 *
 * It uses an atomic write strategy: write to a temporary file and rename it
 * into place. This reduces the chance of corrupted profiles after abrupt
 * mobile/Termux interruption.
 *
 * Complexity:
 * - load/save: O(1) relative to fixed-size profile payload
 * - memory: O(1)
 */
export class JsonRiskProfileRepository implements RiskProfileRepository {
  private readonly filePath: string;

  public constructor(pathOrDirectory: string) {
    this.filePath = pathOrDirectory.endsWith('.json')
      ? pathOrDirectory
      : join(pathOrDirectory, 'risk-profile.json');
  }

  public getPath(): string {
    return this.filePath;
  }

  public async load(): Promise<RiskProfileRepositoryLoadResult> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const profile = this.normalize(parsed);

      return {
        found: true,
        profile,
        reason: 'risk profile loaded',
      };
    } catch (error) {
      if (this.isFileNotFound(error)) {
        return {
          found: false,
          profile: null,
          reason: 'risk profile not found',
        };
      }

      return {
        found: false,
        profile: null,
        reason: `risk profile rejected: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  public async save(
    profile: OperatorRiskProfile,
  ): Promise<RiskProfileRepositorySaveResult> {
    this.assertProfile(profile);

    await mkdir(dirname(this.filePath), { recursive: true });

    const serialized: SerializedRiskProfile = {
      bankroll: profile.bankroll,
      riskMode: profile.riskMode,
      baseStake: profile.baseStake,
      dailyStopWin: profile.dailyStopWin,
      dailyStopLoss: profile.dailyStopLoss,
      maxSingleExposure: profile.maxSingleExposure,
      maxMartingaleSteps: profile.maxMartingaleSteps,
      recommendedSessionGoal: profile.recommendedSessionGoal,
    };

    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(serialized, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);

    return {
      accepted: true,
      path: this.filePath,
      reason: 'risk profile saved',
    };
  }

  private normalize(record: Record<string, unknown>): OperatorRiskProfile {
    const profile = {
      bankroll: this.number(record.bankroll, 'bankroll'),
      riskMode: this.riskMode(record.riskMode),
      baseStake: this.number(record.baseStake, 'baseStake'),
      dailyStopWin: this.number(record.dailyStopWin, 'dailyStopWin'),
      dailyStopLoss: this.number(record.dailyStopLoss, 'dailyStopLoss'),
      maxSingleExposure: this.number(record.maxSingleExposure, 'maxSingleExposure'),
      maxMartingaleSteps: this.integer(record.maxMartingaleSteps, 'maxMartingaleSteps'),
      recommendedSessionGoal: this.string(record.recommendedSessionGoal, 'recommendedSessionGoal'),
    };

    this.assertProfile(profile);
    return profile;
  }

  private assertProfile(profile: OperatorRiskProfile): void {
    this.positive(profile.bankroll, 'bankroll');
    this.positive(profile.baseStake, 'baseStake');
    this.positive(profile.dailyStopWin, 'dailyStopWin');
    this.positive(profile.dailyStopLoss, 'dailyStopLoss');
    this.positive(profile.maxSingleExposure, 'maxSingleExposure');

    if (!Number.isInteger(profile.maxMartingaleSteps) || profile.maxMartingaleSteps < 0) {
      throw new Error('maxMartingaleSteps must be a non-negative integer');
    }

    if (
      profile.riskMode !== 'CONSERVATIVE' &&
      profile.riskMode !== 'MODERATE' &&
      profile.riskMode !== 'AGGRESSIVE'
    ) {
      throw new Error('riskMode must be valid');
    }

    if (profile.recommendedSessionGoal.length === 0) {
      throw new Error('recommendedSessionGoal must not be empty');
    }
  }

  private number(value: unknown, field: string): number {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be finite`);
    }

    return Number(value);
  }

  private integer(value: unknown, field: string): number {
    if (!Number.isInteger(value)) {
      throw new Error(`${field} must be integer`);
    }

    return Number(value);
  }

  private string(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`${field} must be non-empty string`);
    }

    return value;
  }

  private positive(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${field} must be positive`);
    }
  }

  private riskMode(value: unknown): OperatorRiskMode {
    if (value === 'CONSERVATIVE' || value === 'MODERATE' || value === 'AGGRESSIVE') {
      return value;
    }

    throw new Error('riskMode must be valid');
  }

  private isFileNotFound(error: unknown): boolean {
    return (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
