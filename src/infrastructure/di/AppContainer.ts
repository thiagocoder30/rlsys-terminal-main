import { LiveSessionCoordinator } from '../../application/live/LiveSessionCoordinator';
import { FileSnapshotLoader } from '../storage/FileSnapshotLoader';
import { TacticalEngineAdapter, StandardHealthGuard } from './SystemAdapters';
import { RealFinancialGuard, FileCooldownGuard } from '../defenses/RealGuards';

export interface BootConfig {
  readonly storageDirectory: string;
  readonly targetSnapshotId: string;
  readonly bootTimeMs: number;
}

export class AppContainer {
  public static bootstrap(config: BootConfig): LiveSessionCoordinator {
    const snapshotLoader = new FileSnapshotLoader(config.storageDirectory);
    const loadResult = snapshotLoader.load(config.targetSnapshotId, config.bootTimeMs);
    if (!loadResult.success) throw new Error(`CRITICAL_BOOT_FAILURE: ${loadResult.error}`);

    const healthGuard = new StandardHealthGuard();
    // Injeção Real: Máximo 3 perdas seguidas ou 10 unidades negativas globais
    const financialGuard = new RealFinancialGuard(3, 10);
    const cooldownGuard = new FileCooldownGuard(config.storageDirectory);
    const tacticalEngine = new TacticalEngineAdapter(loadResult.snapshot);

    const coordinator = new LiveSessionCoordinator(healthGuard, financialGuard, cooldownGuard, tacticalEngine);
    
    // Fail-Fast: Se o operador já estiver em cooldown no arranque, aborta.
    if (cooldownGuard.isOperatorReady(config.bootTimeMs) === 'BLOCKED') {
      throw new Error("SISTEMA BLOQUEADO: Operador em período de Cooldown.");
    }

    return coordinator;
  }
}
