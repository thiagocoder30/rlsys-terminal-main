import { SecureBankrollRepository } from './infrastructure/persistence/SecureBankrollRepository.js';
import { LiveMesaTracker } from './domain/analytics/LiveMesaTracker.js';
import { LivePaperOrchestrator } from './presentation/cli/LivePaperOrchestrator.js';

// 1. Instanciação das dependências (Infra & Analítica)
const bankrollRepository = new SecureBankrollRepository();
const mesaTracker = new LiveMesaTracker();

// 2. Injeção de Dependências no Orquestrador
const orchestrator = new LivePaperOrchestrator(
    bankrollRepository,
    mesaTracker
);

// 3. Ignita o sistema
orchestrator.initialize().catch(err => {
    console.error('Falha crítica na ignição do sistema:', err);
    process.exit(1);
});
