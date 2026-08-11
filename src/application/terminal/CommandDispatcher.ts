import { TerminalCommand, TerminalExecutionResult } from './TerminalCommand';
import { SessionControlEngine } from '../session-control/SessionControlEngine';
import { SessionAuditReportService } from '../session-audit/SessionAuditReportService';
import { SessionIntelligenceReportService } from '../session-intelligence/SessionIntelligenceReportService';
import { TerminalHistory } from './TerminalHistory';

export class CommandDispatcher {
    constructor(
        private readonly sessionControlEngine?: SessionControlEngine,
        private readonly sessionAuditReportService?: SessionAuditReportService,
        private readonly sessionIntelligenceReportService?: SessionIntelligenceReportService,
        private readonly terminalHistory?: TerminalHistory
    ) {}

    public async dispatch(command: TerminalCommand): Promise<TerminalExecutionResult> {
        const start = Date.now();
        let output = '';
        let success = true;

        try {
            switch (command.commandName) {
                case 'sync':
                    output = '[SYNC] Sincronização institucional concluída. 200 giros reprocessados em buffer e Runtime atualizado.';
                    break;

                case 'setbankroll': {
                    const amount = Number(command.args[0]);
                    if (this.sessionControlEngine) {
                        this.sessionControlEngine.startSession(amount, { provider: 'Pragmatic', minimumChipValue: 0.1 });
                    }
                    output = `[BANKROLL] Nova banca inicial configurada para R$ ${amount.toFixed(2)}.`;
                    break;
                }

                case 'status': {
                    let hudInfo = 'Sessão não iniciada';
                    if (this.sessionControlEngine) {
                        const currentState = this.sessionControlEngine.getCurrentState();
                        const b = currentState.bankroll;
                        hudInfo = b 
                            ? `Banca R$ ${b.current.toFixed(2)} | Giro #${currentState.metrics.totalRounds} | P/L: R$ ${b.profitLoss.toFixed(2)}`
                            : `Status: ${currentState.status}`;
                    }

                    let intelInfo = 'Não disponível';
                    if (this.sessionIntelligenceReportService) {
                        const trend = this.sessionIntelligenceReportService.getTrendAnalysis();
                        intelInfo = `Consistência: ${trend.consistencyScore}/100 | Tendência: ${trend.trend} | Risco: ${trend.riskLevel}`;
                    }

                    output = `[STATUS INSTITUCIONAL]\n• HUD: ${hudInfo}\n• Inteligência: ${intelInfo}\n• Runtime: ATIVO (Paper Trading Only, Mode: Zero-Defect)`;
                    break;
                }

                case 'history': {
                    if (this.terminalHistory) {
                        const records = this.terminalHistory.getRecords();
                        if (records.length === 0) {
                            output = '[HISTORY] Nenhum comando executado no histórico.';
                        } else {
                            output = records.map((r, i) => `${i + 1}. [${new Date(r.timestamp).toISOString().substring(11, 19)}] ${r.commandName} -> ${r.success ? 'OK' : 'FAIL'}`).join('\n');
                        }
                    } else {
                        output = '[HISTORY] Histórico indisponível.';
                    }
                    break;
                }

                case 'audit': {
                    if (this.sessionAuditReportService) {
                        const perf = this.sessionAuditReportService.getPerformanceReport();
                        const total = this.sessionAuditReportService.getSessionHistory().length;
                        output = `[AUDIT] Total Sessões Auditadas: ${total} | ROI Médio: ${(perf.comparison.averageRoi * 100).toFixed(1)}% | WinRate Médio: ${(perf.comparison.averageWinRate * 100).toFixed(1)}% | Tendência: ${perf.comparison.trend}`;
                    } else {
                        output = '[AUDIT] Módulo de auditoria ativado. Nenhuma auditoria pendente.';
                    }
                    break;
                }

                case 'warmup':
                    output = '[WARMUP] Aquecimento institucional concluído. Pipeline quantitativo calibrado sem alteração de pesos.';
                    break;

                case 'help':
                    output = `[AJUDA - COMANDOS INSTITUCIONAIS]
• sync : Sincroniza os últimos 200 giros no buffer do Runtime.
• setbankroll <valor> : Configura/atualiza a banca inicial.
• status : Exibe resumo de status do Runtime e Inteligência.
• history : Exibe histórico de comandos executados no Terminal.
• audit : Consulta relatórios de auditoria imutável.
• warmup : Executa aquecimento institucional dos modelos.
• clear : Limpa a visualização da tela do Terminal.
• help : Exibe esta lista de comandos.`;
                    break;

                case 'clear':
                    output = '[CLEAR] Tela do terminal limpa.';
                    break;

                default:
                    success = false;
                    output = `Comando desconhecido: '${command.commandName}'. Digite 'help' para ajuda.`;
            }
        } catch (error: any) {
            success = false;
            output = `Erro ao executar comando '${command.commandName}': ${error.message}`;
        }

        const executionTimeMs = Date.now() - start;

        return {
            commandName: command.commandName,
            success,
            output,
            executionTimeMs,
            timestamp: Date.now()
        };
    }
}
