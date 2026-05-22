import { OperatorRiskProfile } from './OperatorRiskProfile';

export interface RiskProfileRepositoryLoadResult {
  readonly found: boolean;
  readonly profile: OperatorRiskProfile | null;
  readonly reason: string;
}

export interface RiskProfileRepositorySaveResult {
  readonly accepted: boolean;
  readonly path: string;
  readonly reason: string;
}

export interface RiskProfileRepository {
  load(): Promise<RiskProfileRepositoryLoadResult>;
  save(profile: OperatorRiskProfile): Promise<RiskProfileRepositorySaveResult>;
  getPath(): string;
}
