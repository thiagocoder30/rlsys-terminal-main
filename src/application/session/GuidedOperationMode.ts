export type GuidedOperationState =
  | 'SETUP_REQUIRED'
  | 'READY_TO_START'
  | 'SESSION_ACTIVE'
  | 'SESSION_PAUSED'
  | 'SESSION_FINISHED';

export type GuidedOperationCommand =
  | 'PROFILE_LOADED'
  | 'START_SESSION'
  | 'REGISTER_WIN'
  | 'REGISTER_LOSS'
  | 'PAUSE_SESSION'
  | 'RESUME_SESSION'
  | 'GENERATE_REPORT'
  | 'FINISH_SESSION'
  | 'RESET';

export interface GuidedOperationResult {
  readonly state: GuidedOperationState;
  readonly accepted: boolean;
  readonly message: string;
  readonly nextAction: string;
}

/**
 * Lightweight finite-state workflow for assisted operator sessions.
 *
 * This application service does not execute bets, calculate risk, or persist
 * data. It only guides the operator through a safe operational lifecycle.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class GuidedOperationMode {
  private state: GuidedOperationState;

  public constructor(profileLoaded: boolean = false) {
    this.state = profileLoaded ? 'READY_TO_START' : 'SETUP_REQUIRED';
  }

  public current(): GuidedOperationState {
    return this.state;
  }

  public handle(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'RESET') {
      this.state = 'SETUP_REQUIRED';
      return this.result(true, 'Fluxo reiniciado.', 'Configurar perfil de risco.');
    }

    if (this.state === 'SETUP_REQUIRED') {
      return this.handleSetupRequired(command);
    }

    if (this.state === 'READY_TO_START') {
      return this.handleReady(command);
    }

    if (this.state === 'SESSION_ACTIVE') {
      return this.handleActive(command);
    }

    if (this.state === 'SESSION_PAUSED') {
      return this.handlePaused(command);
    }

    return this.handleFinished(command);
  }

  private handleSetupRequired(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'PROFILE_LOADED') {
      this.state = 'READY_TO_START';
      return this.result(true, 'Perfil carregado com sucesso.', 'Iniciar sessão assistida.');
    }

    return this.result(false, 'Perfil de risco ainda não configurado.', 'Executar setup do operador.');
  }

  private handleReady(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'START_SESSION') {
      this.state = 'SESSION_ACTIVE';
      return this.result(true, 'Sessão assistida iniciada.', 'Registrar win/loss ou consultar status.');
    }

    if (command === 'PROFILE_LOADED') {
      return this.result(true, 'Perfil já está carregado.', 'Iniciar sessão assistida.');
    }

    return this.result(false, 'Sessão ainda não foi iniciada.', 'Usar START_SESSION.');
  }

  private handleActive(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'REGISTER_WIN') {
      return this.result(true, 'Vitória registrada no fluxo guiado.', 'Atualizar ledger e verificar stop win.');
    }

    if (command === 'REGISTER_LOSS') {
      return this.result(true, 'Perda registrada no fluxo guiado.', 'Atualizar ledger e verificar cooldown/stop loss.');
    }

    if (command === 'PAUSE_SESSION') {
      this.state = 'SESSION_PAUSED';
      return this.result(true, 'Sessão pausada.', 'Retomar ou gerar relatório.');
    }

    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório solicitado.', 'Gerar relatório humano da sessão.');
    }

    if (command === 'FINISH_SESSION') {
      this.state = 'SESSION_FINISHED';
      return this.result(true, 'Sessão finalizada.', 'Gerar relatório final e encerrar.');
    }

    return this.result(false, 'Comando não permitido durante sessão ativa.', 'Registrar resultado, pausar, reportar ou finalizar.');
  }

  private handlePaused(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'RESUME_SESSION') {
      this.state = 'SESSION_ACTIVE';
      return this.result(true, 'Sessão retomada.', 'Continuar apenas com disciplina operacional.');
    }

    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório solicitado durante pausa.', 'Gerar relatório humano da sessão.');
    }

    if (command === 'FINISH_SESSION') {
      this.state = 'SESSION_FINISHED';
      return this.result(true, 'Sessão finalizada a partir da pausa.', 'Gerar relatório final e encerrar.');
    }

    return this.result(false, 'Sessão está pausada.', 'Retomar, gerar relatório ou finalizar.');
  }

  private handleFinished(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório final solicitado.', 'Gerar relatório humano final.');
    }

    return this.result(false, 'Sessão já foi finalizada.', 'Gerar relatório final ou reiniciar fluxo.');
  }

  private result(
    accepted: boolean,
    message: string,
    nextAction: string,
  ): GuidedOperationResult {
    return {
      state: this.state,
      accepted,
      message,
      nextAction,
    };
  }
}
