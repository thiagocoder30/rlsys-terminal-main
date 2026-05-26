'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  WarmupQualificationRuntimePipeline,
} = require('../dist/application/warmup/WarmupQualificationRuntimePipeline');

function resolveInputPath() {
  return process.env.RLSYS_WARMUP_QUALIFICATION_INPUT_PATH || '';
}

function resolveOutputPath() {
  return process.env.RLSYS_WARMUP_QUALIFICATION_REPORT_PATH ||
    path.join(process.cwd(), 'data', 'paper-runtime', 'warmup-qualification-report.json');
}

function defaultInput() {
  return {
    source: 'manual',
    requiredWarmupSize: 200,
    values: Array.from({ length: 200 }, (_, index) => index % 37),
  };
}

function readInput() {
  const inputPath = resolveInputPath();

  if (!inputPath) {
    return defaultInput();
  }

  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function writeReport(report) {
  const outputPath = resolveOutputPath();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return outputPath;
}

function formatReport(report, outputPath) {
  return [
    'RL.SYS CORE WARMUP QUALIFICATION RUNTIME',
    '============================================================',
    `generatedAt: ${report.generatedAt}`,
    `source: ${report.source}`,
    `status: ${report.status}`,
    `reason: ${report.reason}`,
    `confidenceScore: ${report.confidenceScore}`,
    `operationalGate: ${report.operationalGate}`,
    '',
    'DECISION',
    `tableQualified: ${report.decision.tableQualified}`,
    `supervisedObservationAllowed: ${report.decision.supervisedObservationAllowed}`,
    `supervisedOperationAllowed: ${report.decision.supervisedOperationAllowed}`,
    `liveMoneyAllowed: ${report.decision.liveMoneyAllowed}`,
    `productionMoneyAllowed: ${report.decision.productionMoneyAllowed}`,
    `requiresHumanReview: ${report.decision.requiresHumanReview}`,
    '',
    'EXPLANATION',
    ...report.humanExplanation.map((line) => `- ${line}`),
    '',
    `warmup qualification report: ${outputPath}`,
  ].join('\n');
}

function main() {
  const pipeline = new WarmupQualificationRuntimePipeline();
  const report = pipeline.qualify(readInput());
  const outputPath = writeReport(report);

  console.log(formatReport(report, outputPath));
}

main();
