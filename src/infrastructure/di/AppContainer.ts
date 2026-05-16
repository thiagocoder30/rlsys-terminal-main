import { LiveSessionCoordinator } from '../../application/live/LiveSessionCoordinator';
import { FileSnapshotLoader } from '../storage/FileSnapshotLoader';
import { TacticalEngineAdapter, StandardHealthGuard, StandardFinancialGuard, StandardCooldownGuard } from './SystemAdapters';

export interface BootConfig {
  readonly storageDirectory: string;
  readonly targetSnapshotId: string;
  readonly bootTimeMs: number;
}

export class AppContainer {
  /**
   * Arranca o sistema. Instancia repositórios, carrega a memória e "liga os fios".
   * Postura Fail-Fast: Se algo falhar aqui, o sistema "crasha" antes de iniciar a sessão.
   */
  public static bootstrap(config: BootConfig): LiveSessionCoordinator {
    
    // 1. Inicialização de Infraestrutura (I/O)
    const snapshotLoader = new FileSnapshotLoader(config.storageDirectory);
    
    // 2. Carregamento de Memória RAM (Knowledge Injection)
    const loadResult = snapshotLoader.load(config.targetSnapshotId, config.bootTimeMs);
    
    if (!loadResult.success) {
      throw new Error(`CRITICAL_BOOT_FAILURE: Falha ao carregar inteligência - ${loadResult.error}`);
    }

    // 3. Instanciação dos Adapters de Segurança
    const healthGuard = new StandardHealthGuard();
    const financialGuard = new StandardFinancialGuard();
    const cooldownGuard = new StandardCooldownGuard();
    
    // 4. Injeção do Conhecimento no Motor Tático
    const tacticalEngine = new TacticalEngineAdapter(loadResult.snapshot);

    // 5. Injeção Final no Orquestrador (O(1) Hot Path Entrypoint)
    const coordinator = new LiveSessionCoordinator(
      healthGuard,
      financialGuard,
      cooldownGuard,
      tacticalEngine
    );

    return coordinator;
  }
}
