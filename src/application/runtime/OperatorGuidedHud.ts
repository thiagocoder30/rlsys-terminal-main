import type {
  PaperTestOperatorConsoleCommandResult,
  PaperTestOperatorConsoleState,
} from './PaperTestOperatorConsole.js';

export type OperatorGuidedHudStatus =
  | 'HUD_GUIDED_READY'
  | 'HUD_GUIDED_NEEDS_REVIEW'
  | 'HUD_GUIDED_BLOCKED';

export type OperatorGuidedHudPhase =
  | 'INICIALIZACAO'
  | 'WARMUP'
  | 'QUALIFICACAO'
  | 'OBSERVACAO'
  | 'REGISTRO'
  | 'ENCERRAMENTO'
  | 'CERTIFICACAO'
  | 'CONCLUIDO';

export interface OperatorGuidedHudView {
  readonly status: OperatorGuidedHudStatus;
  readonly faseAtual: OperatorGuidedHudPhase;
  readonly tituloFase: string;
  readonly significado: string;
  readonly proximaAcao: string;
  readonly comandosDisponiveis: readonly string[];
  readonly texto: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Portuguese guided HUD for the PAPER_TEST operator console.
 *
 * This is a presentation/UX layer only. It does not authorize live money, does
 * not execute bets and does not change business decisions.
 */
export class OperatorGuidedHud {
  public renderFromState(state: PaperTestOperatorConsoleState): OperatorGuidedHudView {
    const faseAtual = this.phaseFor(state);
    const status = this.statusFor(state);
    const proximaAcao = this.nextActionFor(state);
    const comandosDisponiveis = this.commandsFor(faseAtual);
    const tituloFase = this.phaseTitle(faseAtual);
    const significado = this.meaningFor(faseAtual, status);

    const lines = [
      '=================================================',
      'RL.SYS CORE — HUD GUIADA DO OPERADOR',
      '=================================================',
      '',
      `Sessão: ${state.repeatSessionId}`,
      `Operador: ${state.operatorId}`,
      `Mesa: ${state.tableId}`,
      `Estratégia: ${state.strategyName}`,
      `Banca PAPER: ${state.bankrollLabel}`,
      '',
      'Modo:',
      'PAPER ONLY',
      '',
      'Dinheiro Real:',
      'BLOQUEADO',
      '',
      'Execução Automática:',
      'BLOQUEADA',
      '',
      'Execução Automática de Aposta:',
      'BLOQUEADA',
      '',
      `Status HUD: ${status}`,
      `Fase Atual: ${tituloFase}`,
      '',
      'Significado:',
      significado,
      '',
      'Resumo Operacional:',
      `Warmup carregado: ${state.warmupLoaded}`,
      `Warmup qualificado: ${state.warmupQualified}`,
      `Rodadas warmup: ${state.totalWarmupRounds}`,
      `Rodadas ao vivo: ${state.liveRounds.length}`,
      `Confirmações PAPER: ${state.confirms}`,
      `Recusas PAPER: ${state.rejects}`,
      `Wins PAPER: ${state.wins}`,
      `Losses PAPER: ${state.losses}`,
      `Skips PAPER: ${state.skips}`,
      `Finalizado: ${state.finished}`,
      `Certificado: ${state.certified}`,
      '',
      'Próxima Ação:',
      proximaAcao,
      '',
      'Comandos Disponíveis Agora:',
      ...comandosDisponiveis.map((command) => `- ${command}`),
      '',
      'Governança:',
      'PaperOnly=true',
      'LiveMoneyAuthorization=false',
      'AutomaticExecutionAllowed=false',
      'AutomaticBetExecutionAllowed=false',
      'HumanSupervisionRequired=true',
      'CertifiesLiveMoney=false',
      'CertifiesProfit=false',
      '=================================================',
    ];

    return Object.freeze({
      status,
      faseAtual,
      tituloFase,
      significado,
      proximaAcao,
      comandosDisponiveis: Object.freeze(comandosDisponiveis),
      texto: `${lines.join('\n')}\n`,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }

  public renderAfterCommand(result: PaperTestOperatorConsoleCommandResult): OperatorGuidedHudView {
    const base = this.renderFromState(result.state);
    const lines = [
      '=================================================',
      'RL.SYS CORE — RESULTADO DO COMANDO',
      '=================================================',
      '',
      `Comando Executado: ${result.command}`,
      `Status Console: ${result.status}`,
      '',
      'Mensagem:',
      result.message,
      '',
      'Próxima Ação Recomendada:',
      result.nextAction,
      '',
      base.texto.trimEnd(),
    ];

    return Object.freeze({
      ...base,
      texto: `${lines.join('\n')}\n`,
    });
  }

  private phaseFor(state: PaperTestOperatorConsoleState): OperatorGuidedHudPhase {
    if (!state.started) return 'INICIALIZACAO';
    if (!state.warmupLoaded) return 'WARMUP';
    if (!state.warmupQualified) return 'QUALIFICACAO';
    if (state.finished && state.certified) return 'CONCLUIDO';
    if (state.finished && !state.certified) return 'CERTIFICACAO';
    if (state.liveRounds.length === 0) return 'OBSERVACAO';
    if (state.confirms > state.wins + state.losses + state.skips) return 'REGISTRO';
    return 'OBSERVACAO';
  }

  private statusFor(state: PaperTestOperatorConsoleState): OperatorGuidedHudStatus {
    if (state.finished && !state.certified) return 'HUD_GUIDED_NEEDS_REVIEW';
    return 'HUD_GUIDED_READY';
  }

  private phaseTitle(phase: OperatorGuidedHudPhase): string {
    const titles: Record<OperatorGuidedHudPhase, string> = {
      INICIALIZACAO: 'INICIALIZAÇÃO',
      WARMUP: 'WARMUP',
      QUALIFICACAO: 'QUALIFICAÇÃO',
      OBSERVACAO: 'OBSERVAÇÃO',
      REGISTRO: 'REGISTRO PAPER',
      ENCERRAMENTO: 'ENCERRAMENTO',
      CERTIFICACAO: 'CERTIFICAÇÃO',
      CONCLUIDO: 'CONCLUÍDO',
    };

    return titles[phase];
  }

  private meaningFor(phase: OperatorGuidedHudPhase, status: OperatorGuidedHudStatus): string {
    if (status === 'HUD_GUIDED_BLOCKED') {
      return 'Há bloqueio operacional. Não continue até corrigir o problema.';
    }

    const meanings: Record<OperatorGuidedHudPhase, string> = {
      INICIALIZACAO: 'O console ainda não iniciou o teste PAPER. Comece pelo comando start.',
      WARMUP: 'A sessão PAPER iniciou. Agora carregue as últimas 100 ou 200 rodadas observadas.',
      QUALIFICACAO: 'O warmup foi carregado. Agora o sistema precisa qualificar o contexto antes de observar ao vivo.',
      OBSERVACAO: 'Observe a mesa real e registre cada nova rodada no sistema. Não aposte dinheiro real.',
      REGISTRO: 'Há uma confirmação PAPER pendente de resultado. Registre win, loss ou skip.',
      ENCERRAMENTO: 'A sessão deve ser encerrada institucionalmente.',
      CERTIFICACAO: 'A sessão foi finalizada e precisa ser certificada.',
      CONCLUIDO: 'A sessão PAPER foi concluída. Revise logs e relatórios.',
    };

    return meanings[phase];
  }

  private nextActionFor(state: PaperTestOperatorConsoleState): string {
    if (!state.started) return 'Digite: start';
    if (!state.warmupLoaded) return 'Digite: warmup';
    if (!state.warmupQualified) return 'Digite: qualify';
    if (state.finished && !state.certified) return 'Digite: certify';
    if (state.finished && state.certified) return 'Digite: exit';
    if (state.confirms > state.wins + state.losses + state.skips) return 'Digite: win, loss ou skip';
    return 'Digite: round <valor> ou suggestion';
  }

  private commandsFor(phase: OperatorGuidedHudPhase): readonly string[] {
    const common = ['help', 'status', 'ledger', 'exit'];

    if (phase === 'INICIALIZACAO') return Object.freeze(['start', ...common]);
    if (phase === 'WARMUP') return Object.freeze(['warmup', 'warmup-latest', 'warmup-file <arquivo>', 'warmup-paste <rodadas>', ...common]);
    if (phase === 'QUALIFICACAO') return Object.freeze(['qualify', ...common]);
    if (phase === 'OBSERVACAO') return Object.freeze(['round <valor>', 'suggestion', 'confirm', 'reject', 'finish', ...common]);
    if (phase === 'REGISTRO') return Object.freeze(['win', 'loss', 'skip', 'reject', ...common]);
    if (phase === 'ENCERRAMENTO') return Object.freeze(['finish', ...common]);
    if (phase === 'CERTIFICACAO') return Object.freeze(['certify', ...common]);
    return Object.freeze(['status', 'ledger', 'exit']);
  }
}
