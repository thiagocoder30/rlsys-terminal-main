const fs =
  require('node:fs');

const {
  TriplicacaoActionSemantics,
} = require(
  '../../../dist/application/runtime/TriplicacaoActionSemantics.js'
);

const {
  TriplicacaoProspectiveFormationCoordinator,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveFormationCoordinator.js'
);

const {
  TriplicacaoProspectiveRecorder,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveRecorder.js'
);

const {
  TriplicacaoProspectivePerformanceAnalyzer,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectivePerformanceAnalyzer.js'
);

const {
  TriplicacaoProspectiveSessionRuntime,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveSessionRuntime.js'
);

const {
  JsonTriplicacaoProspectiveSignalRepository,
} = require(
  '../../../dist/infrastructure/runtime/JsonTriplicacaoProspectiveSignalRepository.js'
);


const TEST_FILE =
  'data/test/triplicacao-prospective-institutional-runtime.json';


function analysis(
  pattern = 'TC',
  risk = 0.19,
) {
  return {
    baseAnalysis: {},
    metrics: [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      83,

    advancedConfidenceScore:
      0.81,

    advancedRiskScore:
      risk,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [],
    warnings: [],
    blockers: [],
  };
}


function clock() {
  let value =
    1000;

  return {
    now() {
      value +=
        1000;

      return value;
    },
  };
}


function idFactory() {
  let value =
    0;

  return {
    next({
      sessionId,
    }) {
      value +=
        1;

      return `signal-${sessionId}-${value}`;
    },
  };
}


function createRuntime({
  bankroll = 30,
  riskMode = 'moderate',
  minimumStake = 0.10,
  martingaleEnabled = false,
} = {}) {
  const repository =
    new JsonTriplicacaoProspectiveSignalRepository(
      TEST_FILE,
    );

  const recorder =
    new TriplicacaoProspectiveRecorder(
      repository,
      clock(),
      idFactory(),
    );

  const formation =
    new TriplicacaoProspectiveFormationCoordinator(
      new TriplicacaoActionSemantics(),
    );

  return new TriplicacaoProspectiveSessionRuntime(
    'paper-test',

    formation,

    recorder,

    new TriplicacaoProspectivePerformanceAnalyzer(),

    {
      initialBankroll:
        bankroll,

      riskMode,

      minimumStake,

      martingaleEnabled,
    },
  );
}


function spin(
  runtime,
  number,
  pattern = 'TC',
  risk = 0.19,
) {
  return runtime.ingest({
    sessionId:
      'paper-test',

    spin:
      number,

    analysis:
      analysis(
        pattern,
        risk,
      ),
  });
}


beforeEach(
  () => {
    fs.rmSync(
      TEST_FILE,
      {
        force:
          true,
      },
    );

    fs.rmSync(
      `${TEST_FILE}.tmp`,
      {
        force:
          true,
      },
    );
  },
);


afterAll(
  () => {
    fs.rmSync(
      TEST_FILE,
      {
        force:
          true,
      },
    );

    fs.rmSync(
      `${TEST_FILE}.tmp`,
      {
        force:
          true,
      },
    );
  },
);


describe(
  'TriplicacaoProspectiveSessionRuntime institutional integration',
  () => {
    test(
      'blocks prospective ingestion before post-Sync boundary becomes LIVE',
      () => {
        const runtime =
          createRuntime();

        expect(
          () =>
            spin(
              runtime,
              1,
            ),
        ).toThrow(
          'post_sync_prospective_signal_not_allowed',
        );
      },
    );


    test(
      's on current-history confirmation enters LIVE directly',
      () => {
        const runtime =
          createRuntime();

        const boundary =
          runtime.confirmHistoryCurrent(
            's',
          );

        expect(
          boundary.mode,
        ).toBe(
          'LIVE',
        );

        expect(
          () =>
            spin(
              runtime,
              1,
            ),
        ).not.toThrow();
      },
    );


    test(
      'n enters catch-up and catch-up spins never become prospective evidence',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.recordCatchUpSpin(
          32,
        );

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.totalRecordedSignals,
        ).toBe(0);

        expect(
          snapshot.currentBankroll,
        ).toBe(30);

        expect(
          snapshot.pendingLossDebt,
        ).toBe(0);

        expect(
          () =>
            spin(
              runtime,
              1,
            ),
        ).toThrow(
          'post_sync_prospective_signal_not_allowed',
        );

        const live =
          runtime.finishCatchUp();

        expect(
          live.mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'institutional runtime derives 0.60 stake from bankroll 30 moderate pragmatic',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        const result =
          spin(
            runtime,
            3,
          );

        expect(
          result.event,
        ).toBe(
          'RECOMMENDATION_ISSUED',
        );

        expect(
          result.financialRecommendation,
        ).not.toBeNull();

        expect(
          result.financialRecommendation
            .decision,
        ).toBe(
          'BASE_STAKE',
        );

        expect(
          result.financialRecommendation
            .baseStake
            .status,
        ).toBe(
          'RECOMMENDED',
        );

        expect(
          result.financialRecommendation
            .suggestedStake,
        ).toBe(0.60);

        expect(
          result.recommendation
            .suggestedStake,
        ).toBe(0.60);

        expect(
          result.recommendation
            .baseStakeAmount,
        ).toBe(0.60);

        expect(
          result.recommendation
            .recoveryComponent,
        ).toBe(0);
      },
    );


    test(
      's records FOLLOWED but performs no automatic execution',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        const decision =
          runtime.recordOperatorDecisionRaw({
            sessionId:
              'paper-test',

            raw:
              's',
          });

        expect(
          decision.operatorDecision,
        ).toBe(
          'FOLLOWED',
        );

        expect(
          typeof runtime.execute,
        ).toBe(
          'undefined',
        );

        expect(
          typeof runtime.placeBet,
        ).toBe(
          'undefined',
        );

        expect(
          typeof runtime.autoBet,
        ).toBe(
          'undefined',
        );
      },
    );


    test(
      'n records IGNORED and WIN does not increase bankroll',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        runtime.recordOperatorDecisionRaw({
          sessionId:
            'paper-test',

          raw:
            'n',
        });

        const result =
          spin(
            runtime,
            5,
          );

        expect(
          result.settledSignal
            .result,
        ).toBe(
          'WIN',
        );

        expect(
          result.settledSignal
            .operatorDecision,
        ).toBe(
          'IGNORED',
        );

        expect(
          result.financialSettlement,
        ).not.toBeNull();

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );

        expect(
          result.financialSettlement
            .bankrollDelta,
        ).toBe(0);

        expect(
          result.currentBankroll,
        ).toBe(30);

        expect(
          result.pendingLossDebt,
        ).toBe(0);
      },
    );


    test(
      'FOLLOWED WIN increases PAPER bankroll by suggested stake',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        runtime.recordOperatorDecisionRaw({
          sessionId:
            'paper-test',

          raw:
            's',
        });

        const result =
          spin(
            runtime,
            5,
          );

        expect(
          result.settledSignal
            .result,
        ).toBe(
          'WIN',
        );

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'WIN',
        );

        expect(
          result.financialSettlement
            .bankrollDelta,
        ).toBe(0.60);

        expect(
          result.financialSettlement
            .bankrollBefore,
        ).toBe(30);

        expect(
          result.financialSettlement
            .bankrollAfter,
        ).toBe(30.60);

        expect(
          result.currentBankroll,
        ).toBe(30.60);

        expect(
          result.peakBankroll,
        ).toBe(30.60);
      },
    );


    test(
      'FOLLOWED LOSS reduces bankroll and next stake uses reduced bankroll',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        /*
         * TC RED RED
         * target RED
         * BLACK -> LOSS.
         */
        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        runtime.recordOperatorDecisionRaw({
          sessionId:
            'paper-test',

          raw:
            's',
        });

        const loss =
          spin(
            runtime,
            2,
          );

        expect(
          loss.financialSettlement
            .financialSettlement,
        ).toBe(
          'LOSS',
        );

        expect(
          loss.financialSettlement
            .bankrollDelta,
        ).toBe(-0.60);

        expect(
          loss.currentBankroll,
        ).toBe(29.40);

        expect(
          loss.pendingLossDebt,
        ).toBe(0.60);

        /*
         * Martingale defaults OFF in this suite.
         *
         * 2% of 29.40 = 0.588.
         * Pragmatic increment 0.10 -> floor to 0.50.
         */
        spin(
          runtime,
          1,
        );

        const next =
          spin(
            runtime,
            3,
          );

        expect(
          next.financialRecommendation
            .decision,
        ).toBe(
          'BASE_STAKE',
        );

        expect(
          next.recommendation
            .suggestedStake,
        ).toBe(0.50);

        expect(
          next.recommendation
            .recoveryComponent,
        ).toBe(0);
      },
    );


    test(
      'FOLLOWED zero is strategy VOID but financial ZERO_LOSS',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        runtime.recordOperatorDecisionRaw({
          sessionId:
            'paper-test',

          raw:
            's',
        });

        const result =
          spin(
            runtime,
            0,
          );

        expect(
          result.event,
        ).toBe(
          'TRIO_VOID',
        );

        expect(
          result.settledSignal
            .result,
        ).toBe(
          'VOID',
        );

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'ZERO_LOSS',
        );

        expect(
          result.financialSettlement
            .bankrollDelta,
        ).toBe(-0.60);

        expect(
          result.currentBankroll,
        ).toBe(29.40);

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);

        expect(
          result.performance
            .voids,
        ).toBe(1);
      },
    );


    test(
      'IGNORED zero has zero bankroll and recovery impact',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        spin(
          runtime,
          3,
        );

        runtime.recordOperatorDecisionRaw({
          sessionId:
            'paper-test',

          raw:
            'n',
        });

        const result =
          spin(
            runtime,
            0,
          );

        expect(
          result.settledSignal
            .result,
        ).toBe(
          'VOID',
        );

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );

        expect(
          result.financialSettlement
            .bankrollDelta,
        ).toBe(0);

        expect(
          result.currentBankroll,
        ).toBe(30);

        expect(
          result.pendingLossDebt,
        ).toBe(0);
      },
    );


    test(
      'blocks recommendation when minimum chip exceeds safe bankroll exposure',
      () => {
        const runtime =
          createRuntime({
            bankroll:
              8,

            riskMode:
              'conservative',

            minimumStake:
              0.50,
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
        );

        const result =
          spin(
            runtime,
            3,
          );

        expect(
          result.event,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.recommendation,
        ).toBeNull();

        expect(
          result.financialRecommendation,
        ).not.toBeNull();

        expect(
          result.financialRecommendation
            .decision,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.financialRecommendation
            .baseStake
            .status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.financialRecommendation
            .blockers,
        ).toContain(
          'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
        );

        expect(
          result.currentBankroll,
        ).toBe(8);
      },
    );


    test(
      'high strategy risk blocks stake without touching bankroll',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(
          runtime,
          1,
          'TC',
          0.19,
        );

        const result =
          spin(
            runtime,
            3,
            'TC',
            0.70,
          );

        expect(
          result.event,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.financialRecommendation
            .decision,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.financialRecommendation
            .baseStake
            .status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.financialRecommendation
            .blockers,
        ).toContain(
          'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
        );

        expect(
          result.currentBankroll,
        ).toBe(30);

        expect(
          result.pendingLossDebt,
        ).toBe(0);
      },
    );


    test(
      'institutional snapshot exposes shared financial authority',
      () => {
        const runtime =
          createRuntime();

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.institutionalMode,
        ).toBe(true);

        expect(
          snapshot.currentBankroll,
        ).toBe(30);

        expect(
          snapshot.peakBankroll,
        ).toBe(30);

        expect(
          snapshot.pendingLossDebt,
        ).toBe(0);

        expect(
          snapshot.capitalDecision,
        ).toBe(
          'ALLOW',
        );

        expect(
          snapshot.martingaleEnabled,
        ).toBe(false);

        expect(
          snapshot.recommendationOnly,
        ).toBe(true);

        expect(
          snapshot.humanExecutionRequired,
        ).toBe(true);

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
