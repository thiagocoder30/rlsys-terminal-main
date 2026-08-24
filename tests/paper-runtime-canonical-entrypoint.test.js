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
  'paper paper:live and paper:manual share the canonical supervised runtime',
  () => {
    const pkg =
      packageJson();

    const canonical =
      'node scripts/paper-runtime-session.js';

    assert.equal(
      pkg.scripts.paper,
      canonical,
    );

    assert.equal(
      pkg.scripts['paper:live'],
      canonical,
    );

    assert.equal(
      pkg.scripts['paper:manual'],
      canonical,
    );

    assert.equal(
      pkg.scripts['paper:live'],
      pkg.scripts.paper,
    );

    assert.equal(
      pkg.scripts['paper:manual'],
      pkg.scripts.paper,
    );
  },
);


test(
  'paper entrypoints do not invoke legacy tactical orchestrator',
  () => {
    const pkg =
      packageJson();

    for (
      const command of [
        pkg.scripts.paper,
        pkg.scripts['paper:live'],
        pkg.scripts['paper:manual'],
      ]
    ) {
      assert.doesNotMatch(
        command,
        /live-paper-orchestrator/,
      );

      assert.doesNotMatch(
        command,
        /manual-warmup-injector/,
      );
    }
  },
);


test(
  'paper:live no longer injects implicit OCR warmup fetch',
  () => {
    const pkg =
      packageJson();

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
