const {
  FusionReducedLiveTerminalController,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveTerminalController.js',
);


const TARGET = [
  17, 34, 6,
  27, 13, 36,
  11, 30, 8,
  23,
  10, 5, 24,
  16, 33, 1,
  20, 14, 31,
];


function eligibleHistory() {
  /*
   * 80 spins:
   *
   * overall:
   * 48/80 = 60%
   *
   * last 24:
   * 15/24 = 62.5%
   *
   * This is synthetic evidence used only to prove the
   * prospective lifecycle contract.
   */
  return [
    ...Array(
      33,
    ).fill(
      23,
    ),

    ...Array(
      23,
    ).fill(
      0,
    ),

    ...Array(
      15,
    ).fill(
      23,
    ),

    ...Array(
      9,
    ).fill(
      0,
    ),
  ];
}


describe(
  'Fusion Reduced LIVE counterfactual settlement integration',
  () => {
    test(
      'real evidence and semantics create fixed PAPER hypothesis',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-real',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          result.evidence.eligible,
        ).toBe(
          true,
        );

        expect(
          result.decision.status,
        ).toBe(
          'PAPER_READY',
        );

        expect(
          result.registeredCounterfactualDecision
            .targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          result.previousSettlement,
        ).toBeNull();
      },
    );


    test(
      't plus one inside fixed target settles previous decision as WIN',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-win',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          first.decision.status,
        ).toBe(
          'PAPER_READY',
        );

        const second =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          second.previousSettlement,
        ).not.toBeNull();

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          second.previousSettlement
            .spin,
        ).toBe(
          17,
        );

        expect(
          runtime.counterfactualSnapshot()
            .winCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      't plus one outside fixed target settles previous decision as LOSS',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-loss',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          first.decision.status,
        ).toBe(
          'PAPER_READY',
        );

        const second =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          second.previousSettlement,
        ).not.toBeNull();

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          runtime.counterfactualSnapshot()
            .lossCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'decision created at t is never settled by t itself',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-boundary',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          first.registeredCounterfactualDecision,
        ).not.toBeNull();

        expect(
          first.previousSettlement,
        ).toBeNull();

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );

        expect(
          runtime.pendingCounterfactualDecision(),
        ).not.toBeNull();
      },
    );


    test(
      'zero is ordinary settlement LOSS when outside Fusion target',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-zero',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          23,
        );

        const result =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          result.previousSettlement
            .outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          runtime.historySnapshot()
            .slice(-2),
        ).toEqual([
          23,
          0,
        ]);
      },
    );


    test(
      'Fusion Reduced identity never becomes Heatmap Dynamic',
      () => {
        const runtime =
          new FusionReducedLiveTerminalController({
            sessionId:
              'fusion-reduced-identity',

            synchronizedHistory:
              eligibleHistory(),
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          result.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          result.doctrine.targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          result.strategyId,
        ).not.toBe(
          'heatmap-dynamic',
        );
      },
    );
  },
);
