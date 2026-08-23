'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const {
  PaperRuntimeOperationalGate,
} = require('../dist/application/runtime/PaperRuntimeOperationalGate.js');

const {
  PaperRuntimeSessionSupervisor,
} = require('../dist/application/runtime/PaperRuntimeSessionSupervisor.js');

const {
  PaperRuntimeHudGateComposer,
} = require('../dist/application/runtime/PaperRuntimeHudGateComposer.js');

const {
  PaperRuntimeReplCommandAdapter,
} = require('../dist/application/runtime/PaperRuntimeReplCommandAdapter.js');

const {
  PaperRuntimeInteractiveLoop,
} = require('../dist/application/runtime/PaperRuntimeInteractiveLoop.js');

const {
  PaperRuntimeSessionSnapshotFactory,
} = require('../dist/application/runtime/PaperRuntimeSessionSnapshot.js');

const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require('../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js');

const {
  PaperSessionSetupCoordinator,
} = require('../dist/application/runtime/PaperSessionSetupCoordinator.js');

const {
  PaperSessionSetupCli,
} = require('../dist/presentation/cli/PaperSessionSetupCli.js');

const {
  PaperRuntimeReadinessComposer,
} = require('../dist/application/runtime/PaperRuntimeReadinessComposer.js');

const {
  PaperSessionInstitutionalPreflight,
} = require('../dist/application/runtime/PaperSessionInstitutionalPreflight.js');

const {
  PaperSessionAutomaticLaunchCoordinator,
} = require('../dist/application/runtime/PaperSessionAutomaticLaunchCoordinator.js');

const {
  FirstPaperSessionFinalPreflightOrchestrator,
} = require('../dist/application/runtime/FirstPaperSessionFinalPreflightOrchestrator.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

const {
  PaperLiveOracleEngine,
} = require('../dist/application/runtime/PaperLiveOracleEngine.js');

const {
  TriplicacaoLiveTerminalController,
} = require('../dist/application/runtime/TriplicacaoLiveTerminalController.js');

const {
  TriplicacaoLiveObservability,
} = require('../dist/application/runtime/TriplicacaoLiveObservability.js');

const {
  OperatorExplainabilityPresenter,
} = require('../dist/application/runtime/OperatorExplainabilityPresenter.js');

const {
  PaperRuntimeSpinInputParser,
} = require('../dist/application/runtime/PaperRuntimeSpinInputParser.js');

const {
  TriplicacaoLiveStatsPresenter,
} = require('../dist/application/runtime/TriplicacaoLiveStatsPresenter.js');

const {
  TriplicacaoCounterfactualCalibrationPresenter,
} = require('../dist/application/runtime/TriplicacaoCounterfactualCalibrationPresenter.js');

const {
  TriplicacaoCounterfactualSettlementPresenter,
} = require('../dist/application/runtime/TriplicacaoCounterfactualSettlementPresenter.js');

const {
  HeatmapDynamicLiveTerminalController,
} = require('../dist/application/runtime/HeatmapDynamicLiveTerminalController.js');

const {
  HeatmapDynamicLiveObservability,
} = require('../dist/application/runtime/HeatmapDynamicLiveObservability.js');

const {
  HeatmapDynamicLiveStatsPresenter,
} = require('../dist/application/runtime/HeatmapDynamicLiveStatsPresenter.js');

const {
  FusionReducedLiveTerminalController,
} = require('../dist/application/runtime/FusionReducedLiveTerminalController.js');

const {
  FusionReducedLiveObservability,
} = require('../dist/application/runtime/FusionReducedLiveObservability.js');

const {
  FusionReducedLiveStatsPresenter,
} = require('../dist/application/runtime/FusionReducedLiveStatsPresenter.js');


function resolveSnapshotPath() {
  return (
    process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SESSION_SNAPSHOT_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'session-snapshot.json',
    )
  );
}


function resolveLedgerPath() {
  return (
    process.env.RLSYS_PAPER_ENTRY_LEDGER_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'paper-entry-ledger.jsonl',
    )
  );
}


function resolveEnduranceReportPath() {
  return (
    process.env.RLSYS_RUNTIME_ENDURANCE_REPORT_PATH ||
    process.env.RLSYS_RUNTIME_SOAK_REPORT_PATH ||
    path.join(
      process.cwd(),
      'data',
      'soak',
      'runtime-soak-report.json',
    )
  );
}


function resolveEnduranceBaseline() {
  const configured = String(
    process.env.RLSYS_RUNTIME_ENDURANCE_BASELINE ||
      'MOBILE_CONSERVATIVE',
  )
    .trim()
    .toUpperCase();

  if (
    configured === 'MOBILE_CONSERVATIVE' ||
    configured === 'MOBILE_BALANCED' ||
    configured === 'DESKTOP_BALANCED'
  ) {
    return configured;
  }

  return 'MOBILE_CONSERVATIVE';
}


function createRuntimeLoop() {
  const supervisor =
    new PaperRuntimeSessionSupervisor(
      new PaperRuntimeOperationalGate(),
    );

  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      supervisor,
      new PaperRuntimeHudGateComposer(),
    ),
  );
}


function createSetup() {
  const coordinator =
    new PaperSessionSetupCoordinator();

  const cli =
    new PaperSessionSetupCli(
      coordinator,
      {
        writeLine(message) {
          console.log(message);
        },
      },
      {
        defaultWarmupSize: 200,
      },
    );

  return {
    coordinator,
    cli,
  };
}


function normalizePaperRiskMode(
  value,
) {
  const normalized =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    normalized === 'conservative' ||
    normalized === 'moderate' ||
    normalized === 'aggressive'
  ) {
    return normalized;
  }

  throw new Error(
    `paper_runtime_invalid_triplicacao_risk_mode:${value}`,
  );
}


function resolvePaperMinimumStake(
  configuration,
) {
  const canonicalMinimumChip =
    Number(
      configuration.minimumChipValue,
    );

  if (
    Number.isFinite(
      canonicalMinimumChip,
    ) &&
    canonicalMinimumChip > 0
  ) {
    return canonicalMinimumChip;
  }

  const configured =
    Number(
      configuration.minimumStake,
    );

  if (
    Number.isFinite(
      configured,
    ) &&
    configured > 0
  ) {
    return configured;
  }

  const provider =
    String(
      configuration.provider ?? '',
    )
      .trim()
      .toUpperCase();

  if (
    provider === 'PRAGMATIC'
  ) {
    return 0.10;
  }

  if (
    provider === 'EVOLUTION'
  ) {
    return 0.50;
  }

  throw new Error(
    `paper_runtime_minimum_stake_unavailable:${provider}`,
  );
}


function resolvePaperMartingaleEnabled(
  configuration,
) {
  if (
    typeof configuration.allowMartingale ===
    'boolean'
  ) {
    return configuration.allowMartingale;
  }

  if (
    typeof configuration.martingaleEnabled ===
    'boolean'
  ) {
    return configuration.martingaleEnabled;
  }

  if (
    typeof configuration.martingale ===
    'boolean'
  ) {
    return configuration.martingale;
  }

  const raw =
    String(
      configuration.martingale ??
      configuration.martingaleMode ??
      'off',
    )
      .trim()
      .toLowerCase();

  return (
    raw === 'on' ||
    raw === 'true' ||
    raw === 'enabled' ||
    raw === 'habilitado'
  );
}


function createTriplicacaoLiveController(
  setupSnapshot,
) {
  const configuration =
    setupSnapshot.configuration;

  if (
    configuration === null
  ) {
    throw new Error(
      'paper_runtime_triplicacao_configuration_missing',
    );
  }

  const history =
    setupSnapshot.history;

  if (
    history === null ||
    !Array.isArray(
      history.rounds,
    )
  ) {
    throw new Error(
      'paper_runtime_triplicacao_history_missing',
    );
  }

  return new TriplicacaoLiveTerminalController({
    sessionId:
      configuration.sessionId,

    synchronizedHistory:
      history.rounds,

    bankroll:
      configuration.bankroll,

    riskMode:
      normalizePaperRiskMode(
        configuration.riskMode,
      ),

    minimumStake:
      resolvePaperMinimumStake(
        configuration,
      ),

    martingaleEnabled:
      resolvePaperMartingaleEnabled(
        configuration,
      ),

    signalRepositoryPath:
      path.join(
        process.cwd(),
        'data',
        'paper-runtime',
        `triplicacao-${configuration.sessionId}.json`,
      ),
  });
}


function createHeatmapDynamicLiveController(
  setupSnapshot,
) {
  const configuration =
    setupSnapshot.configuration;

  if (
    configuration === null
  ) {
    throw new Error(
      'paper_runtime_heatmap_dynamic_configuration_missing',
    );
  }

  const history =
    setupSnapshot.history;

  if (
    history === null ||
    !Array.isArray(
      history.rounds,
    )
  ) {
    throw new Error(
      'paper_runtime_heatmap_dynamic_history_missing',
    );
  }

  return new HeatmapDynamicLiveTerminalController({
    sessionId:
      configuration.sessionId,

    synchronizedHistory:
      history.rounds,
  });
}


function createFusionReducedLiveController(
  setupSnapshot,
) {
  const configuration =
    setupSnapshot.configuration;

  if (
    configuration === null
  ) {
    throw new Error(
      'paper_runtime_fusion_reduced_configuration_missing',
    );
  }

  const history =
    setupSnapshot.history;

  if (
    history === null ||
    !Array.isArray(
      history.rounds,
    )
  ) {
    throw new Error(
      'paper_runtime_fusion_reduced_history_missing',
    );
  }

  return new FusionReducedLiveTerminalController({
    sessionId:
      configuration.sessionId,

    synchronizedHistory:
      history.rounds,
  });
}


function createAutomaticLaunchCoordinator(
  institutionalPreflight,
) {
  return new PaperSessionAutomaticLaunchCoordinator(
    institutionalPreflight,

    new PaperRuntimeSessionSupervisor(
      new PaperRuntimeOperationalGate(),
    ),
  );
}


function createInstitutionalPreflight() {
  const ledgerPath =
    resolveLedgerPath();

  /*
   * Preparing the directory is infrastructure setup only.
   * No PAPER entry is written here.
   */
  fs.mkdirSync(
    path.dirname(ledgerPath),
    {
      recursive: true,
    },
  );

  const repository =
    new JsonPaperEntryLedgerRepositoryAdapter({
      filePath: ledgerPath,
    });

  const orchestrator =
    new FirstPaperSessionFinalPreflightOrchestrator(
      repository,
    );

  return new PaperSessionInstitutionalPreflight(
    orchestrator,
  );
}


function loadEnduranceSources() {
  const reportPath =
    resolveEnduranceReportPath();

  if (!fs.existsSync(reportPath)) {
    return [];
  }

  try {
    return [
      {
        name: reportPath,
        content:
          fs.readFileSync(
            reportPath,
            'utf8',
          ),
      },
    ];
  } catch (error) {
    console.log(
      `Endurance evidence could not be loaded: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );

    return [];
  }
}


function createRuntimeCertificationInput() {
  return {
    hasInteractiveLoop: true,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion:
      true,
  };
}


function saveSnapshot(
  loop,
  gracefulShutdown,
) {
  const state =
    loop.currentState();

  const snapshot =
    new PaperRuntimeSessionSnapshotFactory().create({
      sessionState:
        state.sessionState,

      iteration:
        state.iteration,

      lastCommand:
        state.lastCommand,

      gracefulShutdown,
    });

  new JsonPaperRuntimeSessionSnapshotRepository(
    resolveSnapshotPath(),
  ).save(snapshot);

  return snapshot;
}


function saveAutomaticRuntimeSnapshot(
  loop,
  sessionState,
  lastCommand,
) {
  const previous =
    loop.currentState();

  const snapshot =
    new PaperRuntimeSessionSnapshotFactory().create({
      sessionState,

      iteration:
        previous.iteration + 1,

      lastCommand,

      gracefulShutdown:
        false,
    });

  new JsonPaperRuntimeSessionSnapshotRepository(
    resolveSnapshotPath(),
  ).save(snapshot);

  return snapshot;
}


function snapshotPathAvailable() {
  return fs.existsSync(
    resolveSnapshotPath(),
  );
}


function ledgerPathConfigured() {
  const ledgerPath =
    resolveLedgerPath();

  try {
    const directory =
      path.dirname(
        ledgerPath,
      );

    fs.mkdirSync(
      directory,
      {
        recursive: true,
      },
    );

    fs.accessSync(
      directory,
      fs.constants.W_OK,
    );

    return true;
  } catch {
    return false;
  }
}


function composeRuntimeReadiness(
  setup,
  loop,
) {
  const snapshot =
    setup.coordinator.snapshot();

  const configuration =
    snapshot.configuration;

  if (
    configuration === null ||
    configuration.status !== 'CONFIGURED'
  ) {
    throw new Error(
      'paper_runtime_readiness_configuration_not_ready',
    );
  }

  if (
    snapshot.qualification === null ||
    !snapshot.qualification.qualified
  ) {
    throw new Error(
      'paper_runtime_readiness_warmup_not_qualified',
    );
  }

  const runtimeState =
    loop.currentState();

  return new PaperRuntimeReadinessComposer()
    .compose({
      configuration,

      runtimeCertification:
        createRuntimeCertificationInput(),

      endurance: {
        sources:
          loadEnduranceSources(),

        baseline:
          resolveEnduranceBaseline(),
      },

      operatorSupervised:
        true,

      sessionState:
        runtimeState.sessionState,

      nowEpochMs:
        Date.now(),
    });
}


function printSetupHeader() {
  console.log([
    '',
    '======================================================',
    ' RL.SYS CORE — PAPER SESSION SETUP',
    '======================================================',
    ' Modo .......... PAPER supervisionado',
    ' Dinheiro real . BLOQUEADO',
    ' Auto execução . BLOQUEADA',
    '------------------------------------------------------',
    '',
    ' Exemplo:',
    ' configure 150 pragmatic moderate off Thiago',
    '',
    ' Depois:',
    ' sync',
    '',
    ' Cole o histórico e finalize com linha vazia.',
    '======================================================',
    '',
  ].join('\n'));
}


function printPreviousSnapshotNotice() {
  try {
    const repository =
      new JsonPaperRuntimeSessionSnapshotRepository(
        resolveSnapshotPath(),
      );

    const previous =
      repository.load();

    if (previous !== null) {
      console.log(
        `Previous snapshot detected: state=${previous.sessionState} graceful=${previous.gracefulShutdown}`,
      );
    }
  } catch (error) {
    console.log(
      `Previous snapshot ignored: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}


function printRuntimeReadinessHud(
  report,
) {
  const blockers =
    report.readiness.blockers.length > 0
      ? report.readiness.blockers
          .map(
            (item) =>
              `  - ${item}`,
          )
          .join('\n')
      : '  - nenhum';

  const warnings =
    report.readiness.warnings.length > 0
      ? report.readiness.warnings
          .map(
            (item) =>
              `  - ${item}`,
          )
          .join('\n')
      : '  - nenhum';

  console.log([
    '',
    '======================================================',
    ' RL.SYS CORE — PAPER RUNTIME READINESS',
    '======================================================',

    ` Runtime certification .. ${report.runtimeCertification.status}`,
    ` Runtime score .......... ${report.runtimeCertification.score}`,

    ` Endurance .............. ${report.endurance.status}`,
    ` Endurance evidence ..... ${report.endurance.hasEvidence ? 'SIM' : 'NÃO'}`,
    ` Endurance sources ...... ${report.endurance.sourceCount}`,

    ` Risk verdict ........... ${report.risk.decision.verdict}`,
    ` Risk readiness ......... ${report.readiness.riskReadiness}`,

    ` Base stake ............. R$ ${report.risk.requestedStake
      .toFixed(2)
      .replace('.', ',')}`,

    ` Operator mode .......... ${report.readiness.operatorMode}`,
    ` Session state .......... ${report.readiness.sessionState}`,

    '------------------------------------------------------',

    ` PREPARE ................ ${
      report.readyForPrepare
        ? 'ELEGÍVEL'
        : 'BLOQUEADO'
    }`,

    '------------------------------------------------------',
    ' Blockers:',
    blockers,

    '------------------------------------------------------',
    ' Warnings:',
    warnings,

    '------------------------------------------------------',
    ' Dinheiro real ......... BLOQUEADO',
    ' Auto execução ......... BLOQUEADA',
    ' Supervisão humana ..... OBRIGATÓRIA',

    '======================================================',
    '',
  ].join('\n'));
}


function createPreflightPreview(
  setup,
  readinessReport,
) {
  const snapshot =
    setup.coordinator.snapshot();

  const configuration =
    snapshot.configuration;

  return {
    sessionId:
      configuration?.sessionId ??
      'N/A',

    runtimeReady:
      readinessReport.readyForPrepare,

    runtimePaperAvailable:
      readinessReport
        .readiness
        .runtimePaperAvailable,

    runtimeCertification:
      readinessReport
        .runtimeCertification
        .status,

    endurance:
      readinessReport
        .endurance
        .status,

    riskVerdict:
      readinessReport
        .risk
        .decision
        .verdict,

    riskReadiness:
      readinessReport
        .readiness
        .riskReadiness,

    warmup:
      snapshot.qualification
        ?.qualification
        .status ??
      'N/A',

    snapshotPathAvailable:
      snapshotPathAvailable(),

    ledgerPathConfigured:
      ledgerPathConfigured(),

    operatorConfirmedLaunch:
      false,
  };
}


function printAutomaticLaunchPrompt(
  setup,
  readinessReport,
) {
  const snapshot =
    setup.coordinator.snapshot();

  const configuration =
    snapshot.configuration;

  if (
    configuration === null
  ) {
    return;
  }

  console.log([
    '',
    '========================================',
    ' RL.SYS — MESA APROVADA',
    '========================================',
    ` Banca PAPER ...... R$ ${configuration.bankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Provedor ......... ${configuration.provider}`,
    ` Perfil ........... ${configuration.riskMode}`,
    ` Stake base ....... R$ ${readinessReport.risk.requestedStake
      .toFixed(2)
      .replace('.', ',')}`,
    ` Endurance ........ ${readinessReport.endurance.status}`,
    ` Risco ............ ${readinessReport.readiness.riskReadiness}`,
    '',
    ' Todos os controles prévios estão prontos.',
    '',
    ' Iniciar sessão PAPER? [sim/não]',
    '========================================',
    '',
  ].join('\n'));
}


function printAutomaticReadinessBlock(
  readinessReport,
) {
  console.log([
    '',
    '========================================',
    ' RL.SYS — SESSÃO BLOQUEADA',
    '========================================',
    '',
    ...readinessReport.readiness.blockers
      .map(
        (item) =>
          ` • ${item}`,
      ),
    '',
    ' Nenhuma sessão foi iniciada.',
    '========================================',
    '',
  ].join('\n'));
}


function printLiveOracleResult(
  result,
  baseStake,
) {
  const analytics =
    result.analytics;

  const presentation =
    result.presentation;

  const decisionLabel =
    result.oracleDecision ===
    'PAPER_FAVORAVEL'
      ? 'OPORTUNIDADE PAPER'
      : result.oracleDecision ===
        'WATCHLIST'
        ? 'WATCHLIST'
        : 'OBSERVAR';

  console.log([
    '',
    '========================================',
    ' RL.SYS — ORÁCULO PAPER',
    '========================================',
    ` Giro ............... ${result.spin}`,
    ` Giro live .......... ${result.liveRoundIndex}`,
    ` Total observado .... ${result.totalObservedRounds}`,
    '',
    ` Decisão ............ ${decisionLabel}`,
    ` Confiança .......... ${presentation.confidencePercent}%`,
    ` Risco .............. ${presentation.riskLevel}`,
    '',
    ` Padrão dominante ... ${analytics.triplicacao.dominantPattern}`,
    ` Força do padrão .... ${(analytics.triplicacao.dominantRatio * 100)
      .toFixed(1)
      .replace('.', ',')}%`,
    ` Consenso ........... ${analytics.consensus.enginesAligned}/${analytics.consensus.enginesTotal}`,
    ` Contexto ........... ${analytics.consensus.classification}`,
    '',
  ].join('\n'));

  if (
    result.oracleDecision ===
    'PAPER_FAVORAVEL'
  ) {
    console.log([
      '----------------------------------------',
      ' CONTEXTO ANALÍTICO FAVORÁVEL',
      '----------------------------------------',
      presentation.explanation,
      '',
      ' O Oráculo geral classifica o contexto.',
      ' Alvo e stake somente serão exibidos',
      ' quando uma estratégia prospectiva',
      ' independente liberar ACTION.',
      '----------------------------------------',
      '',
    ].join('\n'));

    return;
  }

  if (
    result.oracleDecision ===
    'WATCHLIST'
  ) {
    console.log([
      '----------------------------------------',
      ' WATCHLIST',
      '----------------------------------------',
      presentation.explanation,
      '',
      ' Sinal fraco não libera entrada PAPER.',
      ' Continue observando.',
      '----------------------------------------',
      '',
    ].join('\n'));

    return;
  }

  console.log([
    '----------------------------------------',
    ' OBSERVAR',
    '----------------------------------------',
    presentation.explanation,
    '',
    ' Nenhuma entrada recomendada.',
    '----------------------------------------',
    '',
  ].join('\n'));
}


function printTriplicacaoCompactObservation(
  result,
  observability,
  explainability,
) {
  const observation =
    observability.observe(
      result.runtime,
    );

  console.log(
    explainability
      .triplicacaoLines(
        observation,
      )
      .join('\n'),
  );
}


function printTriplicacaoLiveStatus(
  controller,
  observability,
) {
  if (
    controller === null
  ) {
    console.log([
      '',
      'STATUS LIVE INDISPONÍVEL',
      'Triplicação ainda não foi inicializada.',
      '',
    ].join('\n'));

    return;
  }

  console.log(
    observability
      .status(
        controller
          .snapshot()
          .runtime,
      )
      .join('\n'),
  );

  const terminalSnapshot =
    controller.snapshot();

  console.log([
    ` Live spins .......... ${terminalSnapshot.liveSpinCount}`,
    ` Catch-up spins ...... ${terminalSnapshot.catchUpSpinCount}`,
    ` Histórico total ..... ${terminalSnapshot.totalHistorySize}`,
    '',
  ].join('\n'));
}


function printTriplicacaoHistoryConfirmation() {
  console.log([
    '',
    '========================================',
    ' RL.SYS — FRONTEIRA TEMPORAL',
    '========================================',
    '',
    ' O último número do Sync ainda é',
    ' o giro mais recente da mesa? [s/n]',
    '',
    ' s = sim, iniciar LIVE prospectivo',
    ' n = não, inserir giros de atualização',
    '',
    ' Nenhuma entrada é executada pelo sistema.',
    '========================================',
    '',
  ].join('\n'));
}


function printTriplicacaoCatchUpStarted() {
  console.log([
    '',
    '========================================',
    ' RL.SYS — CATCH-UP',
    '========================================',
    '',
    ' Informe os giros ocorridos após o Sync.',
    ' Digite um número entre 0 e 36 por vez.',
    '',
    ' Quando alcançar o giro atual, digite:',
    '   pronto',
    '',
    ' Durante CATCH-UP:',
    ' - contexto analítico é atualizado',
    ' - nenhuma recomendação é prospectiva',
    ' - banca não é alterada',
    ' - s/n não é solicitado',
    '========================================',
    '',
  ].join('\n'));
}


function printTriplicacaoLiveStarted(
  controller,
) {
  const snapshot =
    controller.snapshot();

  console.log([
    '',
    '========================================',
    ' RL.SYS — LIVE PROSPECTIVO',
    '========================================',
    '',
    ` Histórico total .... ${snapshot.totalHistorySize}`,
    ` Catch-up ............ ${snapshot.catchUpSpinCount}`,
    ` Banca PAPER ......... R$ ${snapshot.runtime.currentBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Martingale .......... ${snapshot.runtime.martingaleEnabled ? 'ON' : 'OFF'}`,
    '',
    ' A partir do PRÓXIMO giro, sinais',
    ' poderão ser auditados prospectivamente.',
    '',
    ' Informe cada novo giro da mesa.',
    '========================================',
    '',
  ].join('\n'));
}


function printTriplicacaoRecommendation(
  result,
) {
  const runtime =
    result.runtime;

  const recommendation =
    runtime.recommendation;

  if (
    recommendation === null
  ) {
    return;
  }

  const financial =
    runtime.financialRecommendation;

  console.log([
    '',
    '========================================',
    ' RL.SYS — OPORTUNIDADE TRIPLICAÇÃO',
    '========================================',
    '',
    ` Padrão .............. ${recommendation.pattern}`,
    ` Entrada sugerida .... ${recommendation.targetColor === 'RED' ? 'VERMELHO' : 'PRETO'}`,
    '',
    ` Stake base .......... R$ ${recommendation.baseStakeAmount
      .toFixed(2)
      .replace('.', ',')}`,
    ` Recovery ............ R$ ${recommendation.recoveryComponent
      .toFixed(2)
      .replace('.', ',')}`,
    ` Stake sugerida ...... R$ ${recommendation.suggestedStake
      .toFixed(2)
      .replace('.', ',')}`,
    '',
    ` Banca ............... R$ ${runtime.currentBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Pico ................ R$ ${runtime.peakBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Recovery debt ....... R$ ${runtime.pendingLossDebt
      .toFixed(2)
      .replace('.', ',')}`,
    '',
    ` Confiança ........... ${Math.round(recommendation.confidenceScore * 100)}%`,
    ` Evidência ........... ${recommendation.evidenceScore}`,
    ` Risco ............... ${Math.round(recommendation.riskScore * 100)}%`,
    ` Capital ............. ${financial?.capital?.decision ?? 'N/A'}`,
    ` Martingale .......... ${financial?.martingaleEnabled ? 'ON' : 'OFF'}`,
    '',
    ' Seguiu manualmente? [s/n]',
    '----------------------------------------',
    ' O RL.Sys apenas orienta.',
    ' Não existe execução automática.',
    '========================================',
    '',
  ].join('\n'));
}


function printTriplicacaoSettlement(
  result,
) {
  const runtime =
    result.runtime;

  const signal =
    runtime.settledSignal;

  const financial =
    runtime.financialSettlement;

  if (
    signal === null
  ) {
    return;
  }

  console.log([
    '',
    '========================================',
    ' RL.SYS — RESULTADO TRIPLICAÇÃO',
    '========================================',
    '',
    ` Padrão .............. ${signal.pattern}`,
    ` Entrada sugerida .... ${signal.targetColor === 'RED' ? 'VERMELHO' : 'PRETO'}`,
    ` Resultado observado . ${signal.thirdColor}`,
    '',
    ` Estatístico ......... ${signal.result}`,
    ` Operador ............ ${signal.operatorDecision}`,
    ` Financeiro .......... ${financial?.financialSettlement ?? 'NO_EXPOSURE'}`,
    '',
    ` Stake ............... R$ ${signal.suggestedStake
      .toFixed(2)
      .replace('.', ',')}`,
    ` Impacto ............. R$ ${(financial?.bankrollDelta ?? 0)
      .toFixed(2)
      .replace('.', ',')}`,
    '',
    ` Banca ............... R$ ${runtime.currentBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Pico ................ R$ ${runtime.peakBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Recovery debt ....... R$ ${runtime.pendingLossDebt
      .toFixed(2)
      .replace('.', ',')}`,
    ` Drawdown ............ ${financial
      ? (financial.drawdownFraction * 100)
          .toFixed(2)
          .replace('.', ',')
      : '0,00'}%`,
    ` Capital ............. ${financial?.capital?.decision ?? 'N/A'}`,
    '========================================',
    '',
  ].join('\n'));
}


function printTriplicacaoFinancialBlock(
  result,
) {
  const runtime =
    result.runtime;

  const financial =
    runtime.financialRecommendation;

  console.log([
    '',
    '========================================',
    runtime.event === 'CAPITAL_STOP'
      ? ' RL.SYS — CAPITAL STOP'
      : ' RL.SYS — ENTRADA BLOQUEADA',
    '========================================',
    '',
    ` Motivo .............. ${financial?.blockers?.join(', ') || financial?.capital?.stopReason || 'CAPITAL_PRESERVATION'}`,
    ` Banca ............... R$ ${runtime.currentBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    ` Pico ................ R$ ${runtime.peakBankroll
      .toFixed(2)
      .replace('.', ',')}`,
    '',
    ' Nenhuma entrada recomendada.',
    ' Nenhuma exposição financeira criada.',
    '========================================',
    '',
  ].join('\n'));
}


function printAutomaticLaunchResult(
  result,
) {
  if (
    result.status === 'RUNNING'
  ) {
    console.log([
      '',
      '========================================',
      ' SESSÃO PAPER INICIADA',
      '========================================',
      ' Status ............ RUNNING',
      ' Preflight ......... APROVADO',
      ' Runtime ........... ATIVO',
      ' Supervisão ........ ATIVA',
      '',
      ' Dinheiro real ..... BLOQUEADO',
      ' Auto execução ..... BLOQUEADA',
      '',
      ' Informe cada novo giro da mesa.',
      ' Digite apenas um número entre 0 e 36.',
      '========================================',
      '',
    ].join('\n'));

    return;
  }

  console.log([
    '',
    '========================================',
    ' SESSÃO NÃO INICIADA',
    '========================================',
    ` Status: ${result.status}`,
    '',
    result.message,
    '',
    ' Nenhuma operação foi executada.',
    '========================================',
    '',
  ].join('\n'));
}


function printPreflightPreview(
  preview,
) {
  const infrastructureReady =
    preview.runtimeReady &&
    preview.runtimePaperAvailable &&
    preview.snapshotPathAvailable &&
    preview.ledgerPathConfigured;

  console.log([
    '',
    '======================================================',
    ' RL.SYS CORE — INSTITUTIONAL PREFLIGHT PREVIEW',
    '======================================================',

    ` SessionId .............. ${preview.sessionId}`,
    ` Warmup ................. ${preview.warmup}`,
    ` Runtime readiness ...... ${preview.runtimeReady ? 'READY' : 'BLOCKED'}`,
    ` Runtime certification .. ${preview.runtimeCertification}`,
    ` Endurance .............. ${preview.endurance}`,
    ` Risk verdict ........... ${preview.riskVerdict}`,
    ` Risk readiness ......... ${preview.riskReadiness}`,
    ` Snapshot ............... ${preview.snapshotPathAvailable ? 'AVAILABLE' : 'MISSING'}`,
    ` Ledger ................. ${preview.ledgerPathConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED'}`,

    '------------------------------------------------------',

    ' Operator confirmation . PENDENTE',

    '------------------------------------------------------',

    ` PREFLIGHT CONFIRMÁVEL .. ${
      infrastructureReady
        ? 'SIM'
        : 'NÃO'
    }`,

    '------------------------------------------------------',

    ' Este comando NÃO gravou confirmação.',
    ' Nenhuma sessão foi iniciada.',
    ' Nenhuma aposta foi executada.',
    '',

    infrastructureReady
      ? ' Se concordar com os checks, digite: confirm'
      : ' Corrija os bloqueios antes de confirmar.',

    '======================================================',
    '',
  ].join('\n'));

  return infrastructureReady;
}


function printPreflightResult(
  execution,
) {
  if (!execution.result.ok) {
    console.log([
      '',
      '======================================================',
      ' RL.SYS CORE — PREFLIGHT ERROR',
      '======================================================',
      ` ${execution.result.error.message}`,
      '',
      ' PREPARE permanece BLOQUEADO.',
      '======================================================',
      '',
    ].join('\n'));

    return false;
  }

  const report =
    execution.result.value;

  console.log([
    '',
    '======================================================',
    ' RL.SYS CORE — FINAL INSTITUTIONAL PREFLIGHT',
    '======================================================',

    ` SessionId .............. ${report.sessionId}`,
    ` Verdict ................ ${report.verdict}`,
    ` Readiness .............. ${report.readinessStatus}`,
    ` Launch ................. ${report.launchStatus}`,
    ` Recorder ............... ${report.recorderStatus}`,
    ` Runbook ................ ${report.runbookStatus}`,

    '------------------------------------------------------',

    ` Ledger entries ........ ${report.ledgerStats.totalEntries}`,
    ` Latest entries ........ ${report.latestEntryCount}`,

    '------------------------------------------------------',
    ' Recommendation:',
    ` ${report.recommendation}`,

    '------------------------------------------------------',
    ' Next operator command:',
    ` ${report.nextOperatorCommand}`,

    '------------------------------------------------------',
    ' Dinheiro real ......... BLOQUEADO',
    ' Auto execução ......... BLOQUEADA',
    ' Supervisão humana ..... OBRIGATÓRIA',

    '------------------------------------------------------',

    ` PREPARE ................ ${
      report.verdict ===
      'PAPER_OPERATIONAL_GO'
        ? 'LIBERADO PELO PREFLIGHT'
        : 'BLOQUEADO'
    }`,

    '======================================================',
    '',
  ].join('\n'));

  return (
    report.verdict ===
    'PAPER_OPERATIONAL_GO'
  );
}


function setupIsQualified(
  setup,
) {
  return (
    setup.coordinator
      .snapshot()
      .status ===
    'QUALIFIED'
  );
}


function setupIsCapturingHistory(
  setup,
) {
  const mode =
    setup.cli.currentMode();

  return (
    mode === 'SYNC_CAPTURE' ||
    mode === 'RESYNC_CAPTURE'
  );
}


function setupPromptFor(
  setup,
  preflightApproved,
) {
  if (
    setup.cli.currentMode() ===
    'SYNC_CAPTURE'
  ) {
    return 'sync> ';
  }

  if (
    setup.cli.currentMode() ===
    'RESYNC_CAPTURE'
  ) {
    return 'resync> ';
  }

  if (preflightApproved) {
    return 'paper-ready> ';
  }

  return 'paper-setup> ';
}


function printPostReadinessInstructions(
  readinessReport,
) {
  if (
    !readinessReport.readyForPrepare
  ) {
    console.log([
      'Runtime readiness ainda bloqueia o próximo gate.',
      '',
      ...readinessReport
        .readiness
        .blockers,
      '',
    ].join('\n'));

    return;
  }

  console.log([
    'Runtime readiness aprovado.',
    '',
    'Próximo comando:',
    '  preflight',
    '',
    'Esse comando apenas exibirá os checks.',
    'A confirmação humana continuará pendente.',
    '',
  ].join('\n'));
}


async function runInteractiveSession() {
  const loop =
    createRuntimeLoop();

  const setup =
    createSetup();

  const institutionalPreflight =
    createInstitutionalPreflight();

  const automaticLaunch =
    createAutomaticLaunchCoordinator(
      institutionalPreflight,
    );

  printSetupHeader();

  console.log(
    setup.cli.help(),
  );

  printPreviousSnapshotNotice();

  const rl =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

  let readinessReport =
    null;

  let preflightPreviewed =
    false;

  let preflightConfirmable =
    false;

  let preflightApproved =
    false;

  let awaitingLaunchConfirmation =
    false;

  let automaticPrepared =
    false;

  let paperRunning =
    false;

  let liveOracle =
    null;

  let triplicacaoLive =
    null;

  let heatmapDynamicLive =
    null;

  let fusionReducedLive =
    null;

  const triplicacaoObservability =
    new TriplicacaoLiveObservability();

  const heatmapDynamicObservability =
    new HeatmapDynamicLiveObservability();

  const fusionReducedObservability =
    new FusionReducedLiveObservability();

  const operatorExplainability =
    new OperatorExplainabilityPresenter();

  const runtimeSpinInputParser =
    new PaperRuntimeSpinInputParser();

  const triplicacaoStatsPresenter =
    new TriplicacaoLiveStatsPresenter();

  const heatmapDynamicStatsPresenter =
    new HeatmapDynamicLiveStatsPresenter();

  const fusionReducedStatsPresenter =
    new FusionReducedLiveStatsPresenter();

  const triplicacaoCalibrationPresenter =
    new TriplicacaoCounterfactualCalibrationPresenter();

  const triplicacaoCounterfactualSettlementPresenter =
    new TriplicacaoCounterfactualSettlementPresenter();

  let awaitingTriplicacaoDecision =
    false;

  let liveBootstrapBlocked =
    false;

  let processing =
    false;


  function refreshPrompt() {
    if (
      paperRunning
    ) {
      if (
        liveBootstrapBlocked
      ) {
        rl.setPrompt(
          'bloqueado> ',
        );

        rl.prompt();
        return;
      }

      if (
        awaitingTriplicacaoDecision
      ) {
        rl.setPrompt(
          'decisão> ',
        );

        rl.prompt();
        return;
      }

      const triplicacaoMode =
        triplicacaoLive
          ?.snapshot()
          .mode ??
        null;

      if (
        triplicacaoMode ===
        'AWAITING_HISTORY_CONFIRMATION'
      ) {
        rl.setPrompt(
          'histórico> ',
        );

        rl.prompt();
        return;
      }

      if (
        triplicacaoMode ===
        'CATCH_UP'
      ) {
        rl.setPrompt(
          'catch-up> ',
        );

        rl.prompt();
        return;
      }

      rl.setPrompt(
        'giro> ',
      );

      rl.prompt();
      return;
    }

    rl.setPrompt(
      setupPromptFor(
        setup,
        preflightApproved,
      ),
    );

    rl.prompt();
  }


  async function handleLine(
    line,
  ) {
    if (processing) {
      console.log(
        'Comando anterior ainda está sendo processado.',
      );
      return;
    }

    processing = true;

    try {
      const command =
        line
          .trim()
          .toLowerCase();

      /*
       * Capture mode has absolute priority.
       * Pasted numbers never become runtime commands.
       */
      if (
        setupIsCapturingHistory(
          setup,
        )
      ) {
        const stepResult =
          setup.cli.step(
            line,
            Date.now(),
          );

        const automaticDecision =
          stepResult
            .automaticQualification
            ?.decision;

        if (
          automaticDecision ===
          'APPROVED'
        ) {
          /*
           * The blank line just completed SYNC/RESYNC and the table
           * qualification succeeded in the same CLI step.
           *
           * Continue directly into runtime readiness instead of returning
           * to paper-setup and waiting for another command.
           */
          saveSnapshot(
            loop,
            false,
          );

          readinessReport =
            composeRuntimeReadiness(
              setup,
              loop,
            );

          if (
            readinessReport.readyForPrepare
          ) {
            awaitingLaunchConfirmation =
              true;

            printAutomaticLaunchPrompt(
              setup,
              readinessReport,
            );
          } else {
            printAutomaticReadinessBlock(
              readinessReport,
            );
          }

          return;
        }

        if (
          automaticDecision ===
            'REJECTED' ||
          automaticDecision ===
            'OBSERVE' ||
          automaticDecision ===
            'SYNC_REJECTED'
        ) {
          /*
           * PaperSessionSetupCli already printed the appropriate user-facing
           * rejection/observation message.
           *
           * No launch gate is evaluated.
           */
          readinessReport =
            null;

          awaitingLaunchConfirmation =
            false;

          automaticPrepared =
            false;

          preflightApproved =
            false;

          return;
        }

        /*
         * Normal multiline capture: keep waiting for more pasted history.
         */
        return;
      }

      if (
        command === 'exit' ||
        command === 'quit'
      ) {
        saveSnapshot(
          loop,
          true,
        );

        rl.close();
        return;
      }

      if (
        !setupIsQualified(
          setup,
        )
      ) {
        setup.cli.step(
          line,
          Date.now(),
        );

        if (
          setupIsQualified(
            setup,
          )
        ) {
          /*
           * Create a real PAPER checkpoint before the institutional preflight.
           */
          saveSnapshot(
            loop,
            false,
          );

          readinessReport =
            composeRuntimeReadiness(
              setup,
              loop,
            );

          if (
            readinessReport.readyForPrepare
          ) {
            awaitingLaunchConfirmation =
              true;

            printAutomaticLaunchPrompt(
              setup,
              readinessReport,
            );
          } else {
            printAutomaticReadinessBlock(
              readinessReport,
            );
          }
        }

        return;
      }

      if (
        readinessReport === null
      ) {
        readinessReport =
          composeRuntimeReadiness(
            setup,
            loop,
          );
      }

      if (
        awaitingLaunchConfirmation
      ) {
        if (
          command === 'sim' ||
          command === 's' ||
          command === 'yes'
        ) {
          if (
            readinessReport === null
          ) {
            console.log(
              'Readiness indisponível. Sessão permanece bloqueada.',
            );

            awaitingLaunchConfirmation =
              false;

            return;
          }

          const launch =
            await automaticLaunch.execute({
              setup:
                setup.coordinator.snapshot(),

              runtimeReadiness:
                readinessReport,

              operatorConfirmedLaunch:
                true,

              snapshotPathAvailable:
                snapshotPathAvailable(),

              ledgerPathConfigured:
                ledgerPathConfigured(),

              generatedAtEpochMs:
                Date.now(),

              strategyName:
                'RL.SYS PAPER SUPERVISED',
            });

          awaitingLaunchConfirmation =
            false;

          paperRunning =
            launch.status ===
            'RUNNING';

          automaticPrepared =
            paperRunning;

          preflightApproved =
            paperRunning;

          printAutomaticLaunchResult(
            launch,
          );

          if (
            paperRunning
          ) {
            const setupSnapshot =
              setup.coordinator.snapshot();

            liveBootstrapBlocked =
              false;

            liveOracle =
              new PaperLiveOracleEngine(
                setupSnapshot.history.rounds,
                setupSnapshot.configuration.bankroll,
              );

            triplicacaoLive =
              createTriplicacaoLiveController(
                setupSnapshot,
              );

            heatmapDynamicLive =
              createHeatmapDynamicLiveController(
                setupSnapshot,
              );

            fusionReducedLive =
              createFusionReducedLiveController(
                setupSnapshot,
              );

            awaitingTriplicacaoDecision =
              false;

            liveBootstrapBlocked =
              false;

            saveAutomaticRuntimeSnapshot(
              loop,
              'RUNNING',
              'automatic-start',
            );

            console.log([
              'Snapshot persistido com estado RUNNING.',
              '',
              `Oráculo inicializado com ${setupSnapshot.history.roundCount} giros do Sync.`,
              'Triplicação institucional inicializada.',
              'Fusion Reduzida inicializada.',
              'Heatmap Dynamic inicializado.',
              '',
              'Antes do primeiro giro prospectivo,',
              'confirme a fronteira temporal do Sync.',
              '',
            ].join('\n'));

            printTriplicacaoHistoryConfirmation();
          }

          return;
        }

        if (
          command === 'não' ||
          command === 'nao' ||
          command === 'n' ||
          command === 'no'
        ) {
          awaitingLaunchConfirmation =
            false;

          console.log([
            '',
            'Sessão não iniciada.',
            'A mesa permanece qualificada,',
            'mas nenhuma operação PAPER foi preparada.',
            '',
            'Digite iniciar para confirmar depois.',
            '',
          ].join('\n'));

          return;
        }

        if (
          command !== 'status'
        ) {
          console.log([
            'Confirme o início da sessão.',
            '',
            'Responda:',
            '  sim',
            'ou',
            '  não',
          ].join('\n'));

          return;
        }
      }


      if (
        paperRunning
      ) {
        if (
          command === 'status'
        ) {
          printTriplicacaoLiveStatus(
            triplicacaoLive,
            triplicacaoObservability,
          );

          if (
            heatmapDynamicLive !==
            null
          ) {
            console.log(
              heatmapDynamicObservability
                .status(
                  heatmapDynamicLive
                    .snapshot(),
                )
                .join('\n'),
            );
          }

          if (
            fusionReducedLive !==
            null
          ) {
            console.log(
              fusionReducedObservability
                .status(
                  fusionReducedLive
                    .snapshot(),
                )
                .join('\n'),
            );
          }

          return;
        }

        if (
          command === 'fusion stats' ||
          command === 'fusion stats detail'
        ) {
          if (
            fusionReducedLive ===
            null
          ) {
            console.log([
              '',
              'ESTATÍSTICAS FUSION REDUZIDA INDISPONÍVEIS',
              'A estratégia ainda não foi inicializada.',
              '',
            ].join('\n'));

            return;
          }

          const fusionReducedStatsReport =
            fusionReducedLive
              .statsSnapshot(
                command ===
                  'fusion stats detail'
                  ? 18
                  : 6,
              );

          if (
            command ===
            'fusion stats detail'
          ) {
            console.log(
              fusionReducedStatsPresenter
                .detail(
                  fusionReducedStatsReport,
                ),
            );
          } else {
            console.log(
              fusionReducedStatsPresenter
                .compact(
                  fusionReducedStatsReport,
                ),
            );
          }

          return;
        }


        if (
          command === 'heatmap stats' ||
          command === 'heatmap stats detail'
        ) {
          if (
            heatmapDynamicLive ===
            null
          ) {
            console.log([
              '',
              'ESTATÍSTICAS HEATMAP DYNAMIC INDISPONÍVEIS',
              'A estratégia ainda não foi inicializada.',
              '',
            ].join('\n'));

            return;
          }

          const heatmapDynamicStatsReport =
            heatmapDynamicLive
              .statsSnapshot(
                command ===
                  'heatmap stats detail'
                  ? 18
                  : 6,
              );

          if (
            command ===
            'heatmap stats detail'
          ) {
            console.log(
              heatmapDynamicStatsPresenter
                .detail(
                  heatmapDynamicStatsReport,
                ),
            );
          } else {
            console.log(
              heatmapDynamicStatsPresenter
                .compact(
                  heatmapDynamicStatsReport,
                ),
            );
          }

          return;
        }


        if (
          command === 'stats' ||
          command === 'stats detail' ||
          command === 'stats calibrate'
        ) {
          if (
            triplicacaoLive ===
            null
          ) {
            console.log([
              '',
              'ESTATÍSTICAS TRIPLICAÇÃO INDISPONÍVEIS',
              'A estratégia ainda não foi inicializada.',
              '',
            ].join('\n'));

            return;
          }

          if (
            command ===
            'stats calibrate'
          ) {
            console.log(
              triplicacaoCalibrationPresenter
                .present(
                  triplicacaoLive
                    .calibrationSnapshot(),

                  triplicacaoLive
                    .jointCalibrationSnapshot(),
                ),
            );

            console.log(
              triplicacaoCounterfactualSettlementPresenter
                .present(
                  triplicacaoLive
                    .counterfactualSettlementSnapshot(),
                ),
            );

            return;
          }

          const statsReport =
            triplicacaoLive
              .statsSnapshot(
                command ===
                  'stats detail'
                  ? 18
                  : 6,
              );

          if (
            command ===
            'stats detail'
          ) {
            console.log(
              triplicacaoStatsPresenter
                .detail(
                  statsReport,
                ),
            );
          } else {
            console.log(
              triplicacaoStatsPresenter
                .compact(
                  statsReport,
                ),
            );
          }

          return;
        }

        if (
          liveBootstrapBlocked
        ) {
          console.log([
            '',
            'RUNTIME LIVE BLOQUEADO.',
            '',
            'A inicialização do modo LIVE falhou.',
            'Nenhum giro será processado nesta sessão.',
            '',
            'Encerre a sessão e inicie novamente',
            'após corrigir a causa registrada.',
            '',
          ].join('\n'));

          return;
        }

        if (
          liveOracle === null ||
          triplicacaoLive === null ||
          heatmapDynamicLive === null ||
          fusionReducedLive === null
        ) {
          console.log([
            'Runtime live indisponível.',
            'A sessão permanece RUNNING, mas nenhuma análise foi executada.',
          ].join('\n'));

          return;
        }

        if (
          awaitingTriplicacaoDecision
        ) {
          if (
            command !== 's' &&
            command !== 'n'
          ) {
            console.log([
              'Resposta inválida.',
              'Informe somente:',
              '  s = seguiu manualmente',
              '  n = não seguiu',
            ].join('\n'));

            return;
          }

          const decision =
            triplicacaoLive
              .recordOperatorDecision(
                command,
              );

          awaitingTriplicacaoDecision =
            false;

          console.log([
            '',
            `Decisão registrada: ${decision.operatorDecision}.`,
            'Nenhuma aposta foi executada pelo RL.Sys.',
            '',
          ].join('\n'));

          return;
        }

        const mode =
          triplicacaoLive
            .snapshot()
            .mode;

        if (
          mode ===
          'AWAITING_HISTORY_CONFIRMATION'
        ) {
          if (
            command !== 's' &&
            command !== 'n'
          ) {
            console.log([
              'Confirme se o Sync ainda está atual.',
              'Responda somente s ou n.',
            ].join('\n'));

            return;
          }

          triplicacaoLive
            .confirmHistoryCurrent(
              command,
            );

          heatmapDynamicLive
            .confirmHistoryCurrent(
              command,
            );

          fusionReducedLive
            .confirmHistoryCurrent(
              command,
            );

          if (
            command === 'n'
          ) {
            printTriplicacaoCatchUpStarted();
            return;
          }

          printTriplicacaoLiveStarted(
            triplicacaoLive,
          );

          return;
        }

        if (
          mode ===
          'CATCH_UP'
        ) {
          const catchUpInput =
            runtimeSpinInputParser
              .parse(
                line,
                {
                  allowReadyCommand:
                    true,
                },
              );

          /*
           * Critical invariant:
           *
           * blank input is not roulette zero.
           *
           * Nothing is appended to:
           * - synchronized analytical history;
           * - catch-up count;
           * - Oracle context;
           * - prospective evidence.
           */
          if (
            catchUpInput.kind ===
            'EMPTY'
          ) {
            console.log([
              'Nenhum giro foi registrado.',
              'Informe um número entre 0 e 36',
              'ou digite pronto.',
            ].join('\n'));

            return;
          }

          if (
            catchUpInput.kind ===
            'COMMAND'
          ) {
            if (
              catchUpInput.command !==
              'READY'
            ) {
              throw new Error(
                'paper_runtime_unknown_catch_up_command',
              );
            }

            triplicacaoLive
              .finishCatchUp();

            heatmapDynamicLive
              .finishCatchUp();

            fusionReducedLive
              .finishCatchUp();

            /*
             * Rebuild the general Oracle with the fully updated
             * history so catch-up becomes context rather than
             * operational live rounds.
             */
            const setupSnapshot =
              setup.coordinator.snapshot();

            if (
              setupSnapshot.configuration ===
              null
            ) {
              throw new Error(
                'paper_runtime_live_oracle_configuration_missing_after_catch_up',
              );
            }

            liveOracle =
              new PaperLiveOracleEngine(
                triplicacaoLive
                  .historySnapshot(),

                setupSnapshot
                  .configuration
                  .bankroll,
              );

            printTriplicacaoLiveStarted(
              triplicacaoLive,
            );

            return;
          }

          if (
            catchUpInput.kind ===
            'INVALID'
          ) {
            console.log([
              'Catch-up inválido.',
              'Informe um número inteiro entre 0 e 36',
              'ou digite pronto.',
            ].join('\n'));

            return;
          }

          const catchUpSpin =
            catchUpInput.spin;

          const snapshot =
            triplicacaoLive
              .recordCatchUpSpin(
                catchUpSpin,
              );

          heatmapDynamicLive
            .recordCatchUpSpin(
              catchUpSpin,
            );

          fusionReducedLive
            .recordCatchUpSpin(
              catchUpSpin,
            );

          console.log(
            `Catch-up registrado: ${catchUpSpin} | total=${snapshot.catchUpSpinCount}`,
          );

          return;
        }


        const liveSpinInput =
          runtimeSpinInputParser
            .parse(
              line,
            );

        /*
         * ENTER alone must never become a synthetic roulette zero.
         */
        if (
          liveSpinInput.kind ===
          'EMPTY'
        ) {
          console.log([
            'Nenhum giro foi registrado.',
            'Informe um número inteiro entre 0 e 36.',
          ].join('\n'));

          return;
        }

        if (
          liveSpinInput.kind !==
          'SPIN'
        ) {
          console.log([
            'Giro inválido.',
            'Informe apenas um número inteiro entre 0 e 36.',
          ].join('\n'));

          return;
        }

        const spin =
          liveSpinInput.spin;

        const oracleResult =
          liveOracle.ingest(
            spin,
          );

        const triplicacaoResult =
          triplicacaoLive
            .ingestLiveSpin(
              spin,
            );

        const heatmapDynamicResult =
          heatmapDynamicLive
            .ingestLiveSpin(
              spin,
            );

        const fusionReducedResult =
          fusionReducedLive
            .ingestLiveSpin(
              spin,
            );

        const baseStake =
          readinessReport?.risk
            ?.requestedStake ??
          0;

        printLiveOracleResult(
          oracleResult,
          baseStake,
        );

        printTriplicacaoCompactObservation(
          triplicacaoResult,
          triplicacaoObservability,
          operatorExplainability,
        );

        const heatmapDynamicObservation =
          heatmapDynamicObservability
            .observe(
              heatmapDynamicResult,
            );

        console.log([
          '',
          'Heatmap Dynamic',
          `Estado .............. ${heatmapDynamicObservation.state}`,
          `Modo analítico ...... ${heatmapDynamicObservation.analyticalMode}`,
          `Sinal ............... ${heatmapDynamicObservation.signalStrength}`,
          `Região .............. ${heatmapDynamicObservation.targetRegionId ?? '-'}`,
          `Números ............. ${
            heatmapDynamicObservation.targetNumbers.length > 0
              ? heatmapDynamicObservation.targetNumbers.join(' ')
              : '-'
          }`,
          `Tamanho alvo ........ ${heatmapDynamicObservation.targetSize}`,
          `Cobertura ........... ${heatmapDynamicObservation.coveragePercent
            .toFixed(1)
            .replace('.', ',')}%`,
          `Resumo ............... ${heatmapDynamicObservation.summary}`,
          '',
          'Nenhuma entrada é executada automaticamente.',
          '',
        ].join('\n'));

        const fusionReducedObservation =
          fusionReducedObservability
            .observe(
              fusionReducedResult,
            );

        console.log([
          '',
          'Fusion Reduzida',
          `Estado .............. ${fusionReducedObservation.state}`,
          `Elegível ............ ${fusionReducedObservation.eligible ? 'SIM' : 'NÃO'}`,
          `Confiança ........... ${(
            fusionReducedObservation.confidenceScore *
            100
          )
            .toFixed(1)
            .replace('.', ',')}%`,
          `Risco ............... ${(
            fusionReducedObservation.riskScore *
            100
          )
            .toFixed(1)
            .replace('.', ',')}%`,
          `Hit global .......... ${(
            fusionReducedObservation.observedHitRate *
            100
          )
            .toFixed(1)
            .replace('.', ',')}%`,
          `Hit recente ......... ${(
            fusionReducedObservation.recentHitRate *
            100
          )
            .toFixed(1)
            .replace('.', ',')}%`,
          `Drift ............... ${(
            fusionReducedObservation.rateDrift *
            100
          )
            .toFixed(1)
            .replace('.', ',')}%`,
          'Alvo ................ 23 ± 9',
          `Números ............. ${fusionReducedObservation.targetNumbers.join(' ')}`,
          `Cobertura ........... ${fusionReducedObservation.coveragePercent
            .toFixed(2)
            .replace('.', ',')}%`,
          `Validade ............ ${fusionReducedObservation.recommendationIssued ? 'PRÓXIMO GIRO' : '-'}`,
          `Settlement anterior . ${fusionReducedObservation.previousSettlementOutcome ?? '-'}`,
          `Resumo .............. ${fusionReducedObservation.summary}`,
          '',
          'Nenhuma entrada é executada automaticamente.',
          '',
        ].join('\n'));


        if (
          triplicacaoResult.runtime.event ===
          'RECOMMENDATION_ISSUED'
        ) {
          printTriplicacaoRecommendation(
            triplicacaoResult,
          );

          awaitingTriplicacaoDecision =
            true;

          return;
        }

        if (
          triplicacaoResult.runtime.event ===
            'RECOMMENDATION_SETTLED' ||
          (
            triplicacaoResult.runtime.event ===
              'TRIO_VOID' &&
            triplicacaoResult.runtime.settledSignal !==
              null
          )
        ) {
          printTriplicacaoSettlement(
            triplicacaoResult,
          );

          return;
        }

        if (
          triplicacaoResult.runtime.event ===
            'STAKE_BLOCKED' ||
          triplicacaoResult.runtime.event ===
            'CAPITAL_STOP'
        ) {
          printTriplicacaoFinancialBlock(
            triplicacaoResult,
          );
        }

        return;
      }


      if (
        command === 'iniciar'
      ) {
        if (
          readinessReport === null ||
          !readinessReport.readyForPrepare
        ) {
          console.log(
            'A sessão não está elegível para início.',
          );

          return;
        }

        if (
          automaticPrepared
        ) {
          console.log(
            'A sessão já está preparada.',
          );

          return;
        }

        awaitingLaunchConfirmation =
          true;

        printAutomaticLaunchPrompt(
          setup,
          readinessReport,
        );

        return;
      }


      if (
        command === 'status'
      ) {
        printRuntimeReadinessHud(
          readinessReport,
        );

        if (preflightApproved) {
          console.log(
            'Institutional preflight: PAPER_OPERATIONAL_GO',
          );
        } else if (
          preflightPreviewed
        ) {
          console.log(
            'Institutional preflight: aguardando confirmação.',
          );
        }

        return;
      }

      if (
        command === 'preflight'
      ) {
        if (
          !readinessReport.readyForPrepare
        ) {
          console.log([
            'Preflight bloqueado pelo runtime readiness.',
            '',
            ...readinessReport
              .readiness
              .blockers,
          ].join('\n'));

          return;
        }

        const preview =
          createPreflightPreview(
            setup,
            readinessReport,
          );

        preflightConfirmable =
          printPreflightPreview(
            preview,
          );

        preflightPreviewed =
          true;

        return;
      }

      if (
        command === 'confirm'
      ) {
        if (
          !preflightPreviewed
        ) {
          console.log(
            'Execute preflight antes de confirmar.',
          );
          return;
        }

        if (
          !preflightConfirmable
        ) {
          console.log(
            'Preflight não está confirmável. Corrija os bloqueios.',
          );
          return;
        }

        if (preflightApproved) {
          console.log(
            'Preflight já aprovado anteriormente.',
          );
          return;
        }

        /*
         * Refresh infrastructure facts at the exact confirmation moment.
         */
        const snapshotAvailable =
          snapshotPathAvailable();

        const ledgerConfigured =
          ledgerPathConfigured();

        const execution =
          await institutionalPreflight.execute({
            setup:
              setup.coordinator.snapshot(),

            runtimeReadiness:
              readinessReport,

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              snapshotAvailable,

            ledgerPathConfigured:
              ledgerConfigured,

            generatedAtEpochMs:
              Date.now(),

            strategyName:
              'RL.SYS PAPER SUPERVISED',
          });

        preflightApproved =
          printPreflightResult(
            execution,
          );

        if (preflightApproved) {
          console.log([
            'Preflight institucional aprovado.',
            '',
            'O próximo estágio será PREPARE.',
            'PREPARE ainda NÃO foi executado automaticamente.',
            '',
          ].join('\n'));
        }

        return;
      }

      if (
        command === 'prepare'
      ) {
        if (
          automaticPrepared
        ) {
          console.log([
            'Sessão já preparada automaticamente.',
            'Session state: READY',
            '',
            'Nenhum novo PREPARE foi executado.',
          ].join('\n'));

          return;
        }

        if (
          !preflightApproved
        ) {
          console.log([
            'PREPARE bloqueado.',
            'É necessário obter PAPER_OPERATIONAL_GO primeiro.',
            '',
            'Fluxo:',
            '  preflight',
            '  confirm',
          ].join('\n'));

          return;
        }

        const result =
          loop.handle(
            'prepare',
          );

        console.log([
          '',
          '======================================================',
          ' RL.SYS CORE — PAPER RUNTIME PREPARE',
          '======================================================',
          result.output,
          '------------------------------------------------------',
          ` Accepted ............... ${result.accepted ? 'SIM' : 'NÃO'}`,
          ` Session state .......... ${result.state.sessionState}`,
          ` Iteration .............. ${result.state.iteration}`,
          '------------------------------------------------------',
          ' Dinheiro real .......... BLOQUEADO',
          ' Auto execução .......... BLOQUEADA',
          ' Supervisão humana ...... OBRIGATÓRIA',
          '======================================================',
          '',
        ].join('\n'));

        if (
          result.accepted &&
          result.state.sessionState === 'READY'
        ) {
          saveSnapshot(
            loop,
            false,
          );

          console.log([
            'SESSION_PREPARED confirmado.',
            'Snapshot persistido com estado READY.',
            '',
            'START continua BLOQUEADO neste incremento.',
            'Nenhuma operação PAPER foi iniciada.',
            '',
          ].join('\n'));
        }

        return;
      }

      if (
        command === 'start'
      ) {
        if (
          !preflightApproved
        ) {
          console.log([
            'START bloqueado.',
            'É necessário obter PAPER_OPERATIONAL_GO primeiro.',
          ].join('\n'));

          return;
        }

        if (
          loop.currentState().sessionState !== 'READY'
        ) {
          console.log([
            'START bloqueado.',
            '',
            'A sessão precisa estar em READY.',
            'Execute primeiro:',
            '  prepare',
          ].join('\n'));

          return;
        }

        console.log([
          'START continua BLOQUEADO neste incremento.',
          '',
          'Preflight institucional: APROVADO',
          'Session state: READY',
          '',
          'Nenhuma transição READY -> RUNNING foi executada.',
        ].join('\n'));

        return;
      }

      console.log([
        `Comando desconhecido nesta fase: ${command}`,
        '',
        'Comandos disponíveis:',
        '  status',
        '  iniciar',
        '  exit',
        '',
        'Técnicos/debug:',
        '  preflight',
        '  confirm',
        '  prepare',
      ].join('\n'));
    } catch (error) {
      if (
        paperRunning &&
        (
          liveOracle === null ||
          triplicacaoLive === null ||
          heatmapDynamicLive === null ||
          fusionReducedLive === null
        )
      ) {
        liveBootstrapBlocked =
          true;

        awaitingTriplicacaoDecision =
          false;
      }

      console.log([
        '',
        'RL.SYS CONTROLLED ERROR',
        '=======================',
        error instanceof Error
          ? error.message
          : String(error),
        '',
        'Nenhuma operação foi executada.',
        '',
      ].join('\n'));
    } finally {
      processing = false;

      if (
        rl.listenerCount(
          'line',
        ) > 0
      ) {
        refreshPrompt();
      }
    }
  }


  rl.on(
    'line',
    (line) => {
      void handleLine(
        line,
      );
    },
  );


  rl.on(
    'SIGINT',
    () => {
      try {
        saveSnapshot(
          loop,
          false,
        );
      } finally {
        rl.close();
      }
    },
  );


  rl.on(
    'close',
    () => {
      console.log(
        'RL.SYS paper runtime session closed.',
      );
    },
  );


  refreshPrompt();
}


async function runScriptedSession() {
  /*
   * Keep non-TTY invocation deterministic and fail-closed.
   *
   * Full preflight confirmation is deliberately interactive because it
   * represents explicit human approval.
   */
  console.log(
    'Interactive terminal required for institutional PAPER confirmation.',
  );
}


async function main() {
  if (
    !process.stdin.isTTY
  ) {
    await runScriptedSession();
    return;
  }

  await runInteractiveSession();
}


if (
  require.main === module
) {
  main().catch(
    (error) => {
      console.error(
        '[RL.SYS PAPER FATAL]',
        error,
      );

      process.exitCode = 1;
    },
  );
}


module.exports = {
  resolveSnapshotPath,
  resolveLedgerPath,
  resolveEnduranceReportPath,
  loadEnduranceSources,
  ledgerPathConfigured,
  snapshotPathAvailable,
  composeRuntimeReadiness,
};
