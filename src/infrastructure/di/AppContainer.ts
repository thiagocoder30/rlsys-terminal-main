import { LiveSessionCoordinator } from '../../application/live/LiveSessionCoordinator';
import { FileSnapshotLoader } from '../storage/FileSnapshotLoader';
import { TacticalEngineAdapter, StandardHealthGuard } from './SystemAdapters';
import { RealFinancialGuard, FileCooldownGuard } from '../defenses/RealGuards';
import { FileTelemetryLogger } from '../telemetry/FileTelemetryLogger';
import { SessionTelemetryLogger } from '../../application/telemetry/TelemetryContracts';

export interface BootConfig {
  readonly storageDirectory: string;
  readonly targetSnapshotId: string;
  readonly bootTimeMs: number;
}

export interface BootResult {
  readonly coordinator: LiveSessionCoordinator;
  readonly logger: SessionTelemetryLogger;
}

export class AppContainer {
  public static bootstrap(config: BootConfig): BootResult {
    const snapshotLoader = new FileSnapshotLoader(config.storageDirectory);
    const loadResult = snapshotLoader.load(config.targetSnapshotId, config.bootTimeMs);
    if (!loadResult.success) throw new Error(`CRITICAL_BOOT_FAILURE: ${loadResult.error}`);

    const healthGuard = new StandardHealthGuard();
    const financialGuard = new RealFinancialGuard(3, 10);
    const cooldownGuard = new FileCooldownGuard(config.storageDirectory);
    const tacticalEngine = new TacticalEngineAdapter(loadResult.snapshot);
    const logger = new FileTelemetryLogger(config.storageDirectory);

    const coordinator = new LiveSessionCoordinator(healthGuard, financialGuard, cooldownGuard, tacticalEngine);
    
    if (cooldownGuard.isOperatorReady(config.bootTimeMs) === 'BLOCKED') {
      throw new Error("SISTEMA BLOQUEADO: Operador em período de Cooldown.");
    }

    return { coordinator, logger };
  }
}
