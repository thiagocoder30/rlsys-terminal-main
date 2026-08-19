const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');


const runtimeSource =
  fs.readFileSync(
    path.join(
      process.cwd(),
      'scripts',
      'paper-runtime-session.js',
    ),
    'utf8',
  );


const setupCliSource =
  fs.readFileSync(
    path.join(
      process.cwd(),
      'src',
      'presentation',
      'cli',
      'PaperSessionSetupCli.ts',
    ),
    'utf8',
  );


test(
  'Setup CLI wires central operator explainability presenter',
  () => {
    assert.match(
      setupCliSource,
      /OperatorExplainabilityPresenter/,
    );

    assert.match(
      setupCliSource,
      /this\.explainability/,
    );
  },
);


test(
  'automatic table qualification uses formal presenter',
  () => {
    assert.match(
      setupCliSource,
      /\.qualificationLines\(/,
    );

    assert.doesNotMatch(
      setupCliSource,
      /` Motivo \.\.\.\.\.\.\.\.\.\.\.\.\.\. \$\{report\.reason\}`/,
    );
  },
);


test(
  'automatic qualification decision remains outside presenter',
  () => {
    assert.match(
      setupCliSource,
      /PaperSessionAutomaticQualification/,
    );

    assert.match(
      setupCliSource,
      /automatic\.decision/,
    );
  },
);


test(
  'technical qualify command remains explicitly technical',
  () => {
    assert.match(
      setupCliSource,
      /QUALIFICAÇÃO TÉCNICA/,
    );

    assert.match(
      setupCliSource,
      /`Motivo: \$\{report\.reason\}`/,
    );
  },
);


test(
  'paper runtime wires formal Triplicacao presenter',
  () => {
    assert.match(
      runtimeSource,
      /OperatorExplainabilityPresenter/,
    );

    assert.match(
      runtimeSource,
      /new OperatorExplainabilityPresenter/,
    );

    assert.match(
      runtimeSource,
      /\.triplicacaoLines\(/,
    );
  },
);


test(
  'compact Triplicacao HUD no longer prints technical reason directly',
  () => {
    assert.doesNotMatch(
      runtimeSource,
      /Motivo \.\.\.\.\.\.\.\.\.\.\.\.\. \$\{observation\.reason\}/,
    );
  },
);


test(
  'formalization preserves manual-only philosophy',
  () => {
    assert.doesNotMatch(
      runtimeSource,
      /\.placeBet\(/,
    );

    assert.doesNotMatch(
      runtimeSource,
      /\.autoBet\(/,
    );
  },
);
