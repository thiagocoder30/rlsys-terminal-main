'use strict';

const test =
  require(
    'node:test',
  );

const assert =
  require(
    'node:assert/strict',
  );

const fs =
  require(
    'node:fs',
  );

const path =
  require(
    'node:path',
  );


const root =
  path.resolve(
    __dirname,
    '..',
  );


function packageJson() {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        'package.json',
      ),
      'utf8',
    ),
  );
}


function canonicalRuntimeSource() {
  return fs.readFileSync(
    path.join(
      root,
      'scripts',
      'paper-runtime-session.js',
    ),
    'utf8',
  );
}


test(
  'paper and paper:live share the canonical supervised runtime',
  () => {
    const pkg =
      packageJson();

    assert.equal(
      pkg.scripts.paper,
      'node scripts/paper-runtime-session.js',
    );

    assert.equal(
      pkg.scripts['paper:live'],
      'node scripts/paper-runtime-session.js',
    );

    assert.equal(
      pkg.scripts['paper:live'],
      pkg.scripts.paper,
    );
  },
);


test(
  'paper:live does not invoke legacy tactical orchestrator',
  () => {
    const pkg =
      packageJson();

    assert.doesNotMatch(
      pkg.scripts['paper:live'],
      /live-paper-orchestrator/,
    );

    assert.doesNotMatch(
      pkg.scripts['paper:live'],
      /warmup:fetch/,
    );
  },
);


test(
  'canonical paper runtime exists',
  () => {
    assert.equal(
      fs.existsSync(
        path.join(
          root,
          'scripts',
          'paper-runtime-session.js',
        ),
      ),
      true,
    );
  },
);


test(
  'canonical PAPER entrypoint exposes no direct betting API',
  () => {
    const source =
      canonicalRuntimeSource();

    /*
     * The entrypoint is an operator-facing supervised runtime.
     *
     * Recommendation-only semantics are certified in the strategy
     * wiring suites. At this boundary we assert the stronger and
     * more stable structural property: the runtime itself exposes
     * no direct casino execution primitive.
     */
    assert.doesNotMatch(
      source,
      /\bplaceBet\s*\(/,
    );

    assert.doesNotMatch(
      source,
      /\bexecuteBet\s*\(/,
    );

    assert.doesNotMatch(
      source,
      /\bsubmitBet\s*\(/,
    );

    assert.doesNotMatch(
      source,
      /\bsendBet\s*\(/,
    );
  },
);


test(
  'canonical PAPER entrypoint does not import legacy tactical orchestrator',
  () => {
    const source =
      canonicalRuntimeSource();

    assert.doesNotMatch(
      source,
      /LivePaperOrchestrator/,
    );

    assert.doesNotMatch(
      source,
      /live-paper-orchestrator/,
    );
  },
);


test(
  'canonical PAPER entrypoint retains supervised strategy controllers',
  () => {
    const source =
      canonicalRuntimeSource();

    assert.match(
      source,
      /TriplicacaoLiveTerminalController/,
    );

    assert.match(
      source,
      /FusionReducedLiveTerminalController/,
    );

    assert.match(
      source,
      /HeatmapDynamicLiveTerminalController/,
    );
  },
);
