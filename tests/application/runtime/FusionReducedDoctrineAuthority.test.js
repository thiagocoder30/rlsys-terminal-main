const fs =
  require('node:fs');

const path =
  require('node:path');


describe(
  'Fusion Reduced doctrine authority',
  () => {
    const canonical =
      path.join(
        process.cwd(),
        'src',
        'application',
        'runtime',
        'FusionReducedDoctrineEngine.ts',
      );

    const obsoleteDomain =
      path.join(
        process.cwd(),
        'src',
        'domain',
        'analytics',
        'FusionReducedDoctrineEngine.ts',
      );


    test(
      'has exactly one canonical doctrine source',
      () => {
        expect(
          fs.existsSync(
            canonical,
          ),
        ).toBe(
          true,
        );

        expect(
          fs.existsSync(
            obsoleteDomain,
          ),
        ).toBe(
          false,
        );
      },
    );


    test(
      'canonical doctrine defines fixed 23 plus-minus 9 only',
      () => {
        const source =
          fs.readFileSync(
            canonical,
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'centerNumber:',
        );

        expect(
          source,
        ).toContain(
          'leftNeighbors:',
        );

        expect(
          source,
        ).toContain(
          'rightNeighbors:',
        );

        expect(
          source,
        ).toContain(
          'totalCoverage:',
        );

        expect(
          source,
        ).not.toContain(
          'DOMINANCE_PAPER',
        );

        expect(
          source,
        ).not.toContain(
          'ABSENCE_RESEARCH',
        );

        expect(
          source,
        ).not.toContain(
          'regionPressureScore',
        );

        expect(
          source,
        ).not.toContain(
          'paperThreshold',
        );
      },
    );


    test(
      'evidence remains owned by separate engine',
      () => {
        const evidence =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src',
              'application',
              'runtime',
              'FusionReducedEvidenceEngine.ts',
            ),
            'utf8',
          );

        expect(
          evidence,
        ).toContain(
          'FusionReducedEvidenceEngine',
        );

        expect(
          evidence,
        ).toContain(
          'eligible',
        );

        expect(
          evidence,
        ).toContain(
          'confidenceScore',
        );

        expect(
          evidence,
        ).toContain(
          'riskScore',
        );
      },
    );


    test(
      'decision remains owned by prospective semantics',
      () => {
        const semantics =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src',
              'application',
              'runtime',
              'FusionReducedProspectiveDecisionSemantics.ts',
            ),
            'utf8',
          );

        expect(
          semantics,
        ).toContain(
          "'BLOCKED'",
        );

        expect(
          semantics,
        ).toContain(
          "'OBSERVE'",
        );

        expect(
          semantics,
        ).toContain(
          "'PAPER_READY'",
        );
      },
    );
  },
);
