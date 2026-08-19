import {
  PaperSessionSetupCoordinator,
  type PaperSessionQualificationResult,
  type PaperSessionSetupSnapshot,
} from '../../application/runtime/PaperSessionSetupCoordinator.js';

import {
  PaperSessionAutomaticQualification,
  type PaperSessionAutomaticQualificationResult,
} from '../../application/runtime/PaperSessionAutomaticQualification.js';

import type {
  PaperOperatorProvider,
  PaperSessionOperatorConfigurationSnapshot,
} from '../../application/runtime/PaperSessionOperatorConfiguration.js';

import type {
  OperatorRiskMode,
} from '../../domain/risk/OperatorRiskProfile.js';

import {
  OperatorExplainabilityPresenter,
} from '../../application/runtime/OperatorExplainabilityPresenter.js';


export interface PaperSessionSetupCliOutputPort {
  writeLine(message: string): void;
}


export type PaperSessionSetupCliMode =
  | 'COMMAND'
  | 'SYNC_CAPTURE'
  | 'RESYNC_CAPTURE';


export interface PaperSessionSetupCliStepResult {
  readonly accepted: boolean;
  readonly mode: PaperSessionSetupCliMode;
  readonly message: string;
  readonly snapshot: PaperSessionSetupSnapshot;
  readonly qualification?: PaperSessionQualificationResult;
  readonly automaticQualification?: PaperSessionAutomaticQualificationResult;
}


export interface PaperSessionSetupCliConfiguration {
  readonly defaultWarmupSize?: number;
}


/**
 * User-facing PAPER setup CLI.
 *
 * Normal operational flow:
 *
 *   configure
 *      ↓
 *   sync/resync
 *      ↓
 *   automatic qualification
 *      ↓
 *   APPROVED / OBSERVE / REJECTED
 *
 * qualify remains temporarily available as a technical/debug command.
 */
export class PaperSessionSetupCli {
  private readonly defaultWarmupSize: number;

  private readonly automaticQualification:
    PaperSessionAutomaticQualification;

  private readonly explainability:
    OperatorExplainabilityPresenter;

  private mode: PaperSessionSetupCliMode =
    'COMMAND';

  private historyCaptureLines: string[] = [];


  public constructor(
    private readonly coordinator:
      PaperSessionSetupCoordinator,

    private readonly output:
      PaperSessionSetupCliOutputPort,

    configuration:
      PaperSessionSetupCliConfiguration = {},
  ) {
    this.defaultWarmupSize =
      configuration.defaultWarmupSize ?? 200;

    this.automaticQualification =
      new PaperSessionAutomaticQualification(
        coordinator,
      );

    this.explainability =
      new OperatorExplainabilityPresenter();
  }


  public currentMode():
    PaperSessionSetupCliMode {
    return this.mode;
  }


  public step(
    input: string,
    occurredAtEpochMs: number = Date.now(),
  ): PaperSessionSetupCliStepResult {
    if (
      this.mode === 'SYNC_CAPTURE' ||
      this.mode === 'RESYNC_CAPTURE'
    ) {
      return this.captureHistory(
        input,
        occurredAtEpochMs,
      );
    }

    return this.handleCommand(
      input,
      occurredAtEpochMs,
    );
  }


  public help(): string {
    return [
      'RL.SYS PAPER SESSION',
      '',
      'Commands:',
      '  configure <bankroll> <provider> <riskMode> <martingale> [operatorId]',
      '  sync',
      '  resync',
      '  status',
      '  help',
      '',
      'Technical/debug:',
      '  qualify [warmupSize]',
      '',
      'Providers:',
      '  pragmatic  -> ficha mínima R$ 0,10',
      '  evolution  -> ficha mínima R$ 0,50',
      '',
      'Risk modes:',
      '  conservative',
      '  moderate',
      '  aggressive',
      '',
      'Martingale:',
      '  off',
      '  on',
      '',
      'Exemplo:',
      '  configure 30 pragmatic moderate off Thiago',
      '',
      'Depois:',
      '  sync',
      '',
      'Cole o histórico e finalize com linha vazia.',
      'A qualificação da mesa será automática.',
    ].join('\n');
  }


  private handleCommand(
    input: string,
    occurredAtEpochMs: number,
  ): PaperSessionSetupCliStepResult {
    const normalized =
      input.trim();

    if (normalized.length === 0) {
      return this.respond(
        false,
        'Comando vazio ignorado.',
      );
    }

    const tokens =
      normalized.split(/\s+/);

    const command =
      (tokens[0] ?? '').toLowerCase();

    if (command === 'help') {
      const message =
        this.help();

      this.output.writeLine(
        message,
      );

      return {
        accepted: true,
        mode: this.mode,
        message,
        snapshot:
          this.coordinator.snapshot(),
      };
    }

    if (command === 'status') {
      const snapshot =
        this.coordinator.snapshot();

      const message =
        this.renderStatus(
          snapshot,
        );

      this.output.writeLine(
        message,
      );

      return {
        accepted: true,
        mode: this.mode,
        message,
        snapshot,
      };
    }

    if (command === 'configure') {
      return this.configure(
        tokens,
      );
    }

    if (command === 'sync') {
      return this.beginHistoryCapture(
        'SYNC_CAPTURE',
      );
    }

    if (command === 'resync') {
      return this.beginHistoryCapture(
        'RESYNC_CAPTURE',
      );
    }

    if (command === 'qualify') {
      return this.qualify(
        tokens,
      );
    }

    return this.respond(
      false,
      `Comando desconhecido: ${command}. Digite help.`,
    );
  }


  private configure(
    tokens: readonly string[],
  ): PaperSessionSetupCliStepResult {
    const bankrollRaw =
      tokens[1];

    const providerRaw =
      tokens[2];

    const riskModeRaw =
      tokens[3];

    const martingaleRaw =
      tokens[4];

    const operatorId =
      tokens[5];

    if (
      bankrollRaw === undefined ||
      providerRaw === undefined ||
      riskModeRaw === undefined ||
      martingaleRaw === undefined
    ) {
      return this.respond(
        false,
        [
          'Uso:',
          'configure <bankroll> <provider> <riskMode> <martingale> [operatorId]',
          '',
          'Exemplo:',
          'configure 30 pragmatic moderate off Thiago',
        ].join('\n'),
      );
    }

    const bankroll =
      Number(
        bankrollRaw
          .replace('R$', '')
          .replace(',', '.'),
      );

    if (
      !Number.isFinite(bankroll) ||
      bankroll <= 0
    ) {
      return this.respond(
        false,
        'Banca inválida. Informe um valor positivo.',
      );
    }

    const provider =
      this.parseProvider(
        providerRaw,
      );

    if (provider === undefined) {
      return this.respond(
        false,
        'Provedor inválido. Use pragmatic ou evolution.',
      );
    }

    const riskMode =
      this.parseRiskMode(
        riskModeRaw,
      );

    if (riskMode === undefined) {
      return this.respond(
        false,
        'Modo de risco inválido. Use conservative, moderate ou aggressive.',
      );
    }

    const allowMartingale =
      this.parseMartingale(
        martingaleRaw,
      );

    if (
      allowMartingale === undefined
    ) {
      return this.respond(
        false,
        'Política de martingale inválida. Use on ou off.',
      );
    }

    const sessionId =
      this.createSessionId();

    try {
      const configuration =
        this.coordinator.configure({
          sessionId,
          bankroll,
          provider,
          operatorId,
          riskMode,
          allowMartingale,
        });

      const message =
        this.renderConfiguration(
          configuration,
        );

      this.output.writeLine(
        message,
      );

      return {
        accepted: true,
        mode: this.mode,
        message,
        snapshot:
          this.coordinator.snapshot(),
      };
    } catch (error: unknown) {
      return this.respond(
        false,
        this.describeError(
          error,
        ),
      );
    }
  }


  private beginHistoryCapture(
    mode:
      | 'SYNC_CAPTURE'
      | 'RESYNC_CAPTURE',
  ): PaperSessionSetupCliStepResult {
    const snapshot =
      this.coordinator.snapshot();

    if (
      snapshot.configuration === null ||
      snapshot.configuration.status !==
        'CONFIGURED'
    ) {
      return this.respond(
        false,
        'Configure a sessão antes do Sync.',
      );
    }

    if (
      mode === 'SYNC_CAPTURE' &&
      snapshot.history.status !==
        'UNSYNCED'
    ) {
      return this.respond(
        false,
        'Já existe histórico sincronizado. Use resync para substituir.',
      );
    }

    if (
      mode === 'RESYNC_CAPTURE' &&
      snapshot.history.status ===
        'UNSYNCED'
    ) {
      return this.respond(
        false,
        'Ainda não existe Sync anterior. Use sync primeiro.',
      );
    }

    this.mode = mode;

    this.historyCaptureLines = [];

    const message = [
      mode === 'SYNC_CAPTURE'
        ? 'SYNC iniciado.'
        : 'RESYNC iniciado.',
      'Cole o histórico da mesa.',
      'Finalize enviando uma linha vazia.',
      '',
      'A qualificação será automática.',
    ].join('\n');

    this.output.writeLine(
      message,
    );

    return {
      accepted: true,
      mode: this.mode,
      message,
      snapshot,
    };
  }


  private captureHistory(
    input: string,
    occurredAtEpochMs: number,
  ): PaperSessionSetupCliStepResult {
    if (
      input.trim().length > 0
    ) {
      this.historyCaptureLines.push(
        input,
      );

      return {
        accepted: true,
        mode: this.mode,
        message:
          'Linha adicionada ao histórico.',
        snapshot:
          this.coordinator.snapshot(),
      };
    }

    const rawHistory =
      this.historyCaptureLines.join(
        '\n',
      );

    const captureMode =
      this.mode;

    this.mode =
      'COMMAND';

    this.historyCaptureLines =
      [];

    try {
      const automatic =
        captureMode ===
        'SYNC_CAPTURE'
          ? this.automaticQualification
              .syncAndQualify({
                rawHistory,
                requiredWarmupSize:
                  this.defaultWarmupSize,
                synchronizedAtEpochMs:
                  occurredAtEpochMs,
              })
          : this.automaticQualification
              .resyncAndQualify({
                rawHistory,
                requiredWarmupSize:
                  this.defaultWarmupSize,
                synchronizedAtEpochMs:
                  occurredAtEpochMs,
              });

      const message =
        this.renderAutomaticQualification(
          automatic,
        );

      this.output.writeLine(
        message,
      );

      return {
        accepted:
          automatic.decision !==
          'SYNC_REJECTED',

        mode: this.mode,

        message,

        snapshot:
          automatic.snapshot,

        qualification:
          automatic.qualification,

        automaticQualification:
          automatic,
      };
    } catch (error: unknown) {
      return this.respond(
        false,
        this.describeError(
          error,
        ),
      );
    }
  }


  private qualify(
    tokens: readonly string[],
  ): PaperSessionSetupCliStepResult {
    const sizeRaw =
      tokens[1];

    let requiredWarmupSize =
      this.defaultWarmupSize;

    if (
      sizeRaw !== undefined
    ) {
      const parsed =
        Number(sizeRaw);

      if (
        !Number.isInteger(parsed) ||
        parsed <= 0
      ) {
        return this.respond(
          false,
          'Warmup size inválido.',
        );
      }

      requiredWarmupSize =
        parsed;
    }

    try {
      const result =
        this.coordinator.qualify(
          requiredWarmupSize,
        );

      const message =
        this.renderQualification(
          result,
          requiredWarmupSize,
        );

      this.output.writeLine(
        message,
      );

      return {
        accepted: true,
        mode: this.mode,
        message,
        snapshot:
          this.coordinator.snapshot(),
        qualification:
          result,
      };
    } catch (error: unknown) {
      return this.respond(
        false,
        this.describeError(
          error,
        ),
      );
    }
  }


  private renderAutomaticQualification(
    result:
      PaperSessionAutomaticQualificationResult,
  ): string {
    if (
      result.decision ===
      'SYNC_REJECTED'
    ) {
      return [
        'SYNC REJEITADO',
        '=============',
        '',
        result.sync.parsed.message,
        '',
        result.sync.parsed.invalidTokens.length > 0
          ? `Valores inválidos: ${result.sync.parsed.invalidTokens.join(', ')}`
          : '',
      ]
        .filter(
          (line) =>
            line.length > 0,
        )
        .join('\n');
    }

    const qualification =
      result.qualification;

    if (
      qualification === undefined
    ) {
      return [
        'MESA REPROVADA',
        '=============',
        'Qualificação indisponível.',
      ].join('\n');
    }

    const report =
      qualification
        .qualification
        .qualification;

    /*
     * The automatic qualification decision remains entirely owned
     * by PaperSessionAutomaticQualification and the warm-up pipeline.
     *
     * This presenter changes language only.
     */
    return this.explainability
      .qualificationLines(
        report,
      )
      .join('\n');
  }


  private renderConfiguration(
    configuration:
      PaperSessionOperatorConfigurationSnapshot,
  ): string {
    return [
      'CONFIGURAÇÃO DA SESSÃO',
      `SessionId: ${configuration.sessionId}`,
      `Banca: R$ ${this.money(configuration.bankroll)}`,
      `Provedor: ${configuration.provider}`,
      `Ficha mínima: R$ ${this.money(configuration.minimumChipValue)}`,
      `Risco: ${configuration.riskMode}`,
      `Martingale: ${configuration.allowMartingale ? 'HABILITADO' : 'DESABILITADO'}`,

      configuration.operatorId
        ? `Operador: ${configuration.operatorId}`
        : 'Operador: não informado',

      '',
      'Próximo passo: sync',
    ].join('\n');
  }


  private renderStatus(
    snapshot:
      PaperSessionSetupSnapshot,
  ): string {
    const configuration =
      snapshot.configuration;

    return [
      'RL.SYS PAPER STATUS',
      '===================',

      `Status: ${snapshot.status}`,

      configuration
        ? `SessionId: ${configuration.sessionId}`
        : 'SessionId: não configurado',

      configuration
        ? `Banca: R$ ${this.money(configuration.bankroll)}`
        : 'Banca: não configurada',

      configuration
        ? `Provedor: ${configuration.provider}`
        : 'Provedor: não configurado',

      configuration
        ? `Risco: ${configuration.riskMode}`
        : 'Risco: não configurado',

      configuration
        ? `Martingale: ${configuration.allowMartingale ? 'HABILITADO' : 'DESABILITADO'}`
        : 'Martingale: não configurado',

      `Sync: ${snapshot.history.status}`,
      `Rodadas: ${snapshot.history.roundCount}`,

      snapshot.qualification
        ? `Mesa: ${snapshot.qualification.qualified ? 'APROVADA' : snapshot.status}`
        : 'Mesa: não analisada',
    ].join('\n');
  }


  private renderQualification(
    result:
      PaperSessionQualificationResult,

    requiredWarmupSize:
      number,
  ): string {
    const qualification =
      result.qualification;

    const report =
      qualification.qualification;

    const confidencePercent =
      `${(
        report.confidenceScore *
        100
      )
        .toFixed(1)
        .replace('.', ',')}%`;

    return [
      'QUALIFICAÇÃO TÉCNICA',
      '====================',
      `Status: ${report.status}`,
      `Motivo: ${report.reason}`,
      `Amostra: ${qualification.synchronizedRounds} / ${requiredWarmupSize}`,
      `Confiança: ${confidencePercent}`,
    ].join('\n');
  }


  private parseProvider(
    value: string,
  ): PaperOperatorProvider | undefined {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized === 'pragmatic' ||
      normalized === 'pragmaticplay'
    ) {
      return 'PRAGMATIC';
    }

    if (
      normalized === 'evolution' ||
      normalized === 'evolutiongaming'
    ) {
      return 'EVOLUTION';
    }

    return undefined;
  }


  private parseRiskMode(
    value: string,
  ): OperatorRiskMode | undefined {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized === 'conservative' ||
      normalized === 'conservador' ||
      normalized === 'conservativo'
    ) {
      return 'CONSERVATIVE';
    }

    if (
      normalized === 'moderate' ||
      normalized === 'moderado'
    ) {
      return 'MODERATE';
    }

    if (
      normalized === 'aggressive' ||
      normalized === 'agressivo'
    ) {
      return 'AGGRESSIVE';
    }

    return undefined;
  }


  private parseMartingale(
    value: string,
  ): boolean | undefined {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized === 'on' ||
      normalized === 'true' ||
      normalized === 'sim' ||
      normalized === 'yes'
    ) {
      return true;
    }

    if (
      normalized === 'off' ||
      normalized === 'false' ||
      normalized === 'nao' ||
      normalized === 'não' ||
      normalized === 'no'
    ) {
      return false;
    }

    return undefined;
  }


  private createSessionId(): string {
    return `paper-${Date.now()}`;
  }


  private respond(
    accepted: boolean,
    message: string,
  ): PaperSessionSetupCliStepResult {
    this.output.writeLine(
      message,
    );

    return {
      accepted,
      mode: this.mode,
      message,
      snapshot:
        this.coordinator.snapshot(),
    };
  }


  private money(
    value: number,
  ): string {
    return value
      .toFixed(2)
      .replace('.', ',');
  }


  private describeError(
    error: unknown,
  ): string {
    if (
      error instanceof Error &&
      error.message.length > 0
    ) {
      return error.message;
    }

    return 'Falha desconhecida no setup PAPER.';
  }
}
