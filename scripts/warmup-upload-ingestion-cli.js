'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  WarmupUploadIngestionEngine,
} = require('../dist/domain/warmup-upload-ingestion');

function resolveInputPath() {
  return (
    process.argv[2] ||
    process.env.RLSYS_WARMUP_UPLOAD_INPUT_PATH ||
    ''
  );
}

function resolveOutputPath() {
  return (
    process.env.RLSYS_WARMUP_UPLOAD_REPORT_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'warmup-upload-ingestion-report.json',
    )
  );
}

function readPayload(inputPath) {
  if (!inputPath) {
    throw new Error(
      'Informe o arquivo de warmup: npm run warmup:ingest -- caminho/do/arquivo.json',
    );
  }

  return fs.readFileSync(inputPath, 'utf8');
}

function formatReport(report, outputPath) {
  return [
    'RL.SYS CORE WARMUP UPLOAD INGESTION',
    '============================================================',
    `source: ${report.source}`,
    `decision: ${report.decision}`,
    `reason: ${report.reason}`,
    `extractedRounds: ${report.metrics.extractedRounds}`,
    `acceptedRounds: ${report.metrics.acceptedRounds}`,
    `discardedRounds: ${report.metrics.discardedRounds}`,
    `zeroCount: ${report.metrics.zeroCount}`,
    `redCount: ${report.metrics.redCount}`,
    `blackCount: ${report.metrics.blackCount}`,
    `unknownColorCount: ${report.metrics.unknownColorCount}`,
    `productionMoneyAllowed: ${report.productionMoneyAllowed}`,
    `activeSessionMutationAllowed: ${report.activeSessionMutationAllowed}`,
    '',
    'EXPLANATION',
    `- ${report.explanation}`,
    '',
    `warmup upload ingestion report: ${outputPath}`,
  ].join('\n');
}

function main() {
  const inputPath = resolveInputPath();
  const payload = readPayload(inputPath);

  const result = new WarmupUploadIngestionEngine().evaluate({
    source: inputPath,
    payload,
    policy: {
      requiredWarmupSize: 200,
      minimumRouletteNumber: 0,
      maximumRouletteNumber: 36,
    },
  });

  const report = result.ok ? result.value : result.error;
  const outputPath = resolveOutputPath();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(formatReport(report, outputPath));

  if (!result.ok || report.decision === 'NAO_UTILIZAR') {
    process.exitCode = 1;
  }
}

main();
