#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  WarmupScreenshotImportGateway,
} = require('../dist/application/runtime/WarmupScreenshotImportGateway.js');

function parseArgs(argv) {
  const input = {
    screenshotDir: path.join(process.cwd(), 'data', 'paper-runtime', 'warmup-screenshots'),
    outputDir: path.join(process.cwd(), 'data', 'paper-runtime'),
    screenshotPath: 'latest',
    format: 'text',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('--')) {
      input[key] = true;
      continue;
    }

    if (key === 'minimumRounds') {
      input[key] = Number(value);
    } else {
      input[key] = value;
    }

    index += 1;
  }

  return input;
}

function printText(report) {
  console.log('RL.SYS CORE — WARMUP SCREENSHOT IMPORT GATEWAY');
  console.log('================================================');
  console.log(`Status: ${report.status}`);
  console.log(`Screenshot: ${report.screenshotPath || 'NÃO ENCONTRADO'}`);
  console.log(`Rodadas aceitas: ${report.acceptedRounds}`);
  console.log(`Zeros: ${report.zeroCount}`);
  console.log(`Vermelhos: ${report.redCount}`);
  console.log(`Pretos: ${report.blackCount}`);
  console.log(`Números: ${report.numberCount}`);
  console.log(`Requer extração: ${report.extractionRequired}`);
  console.log(`Warmup output: ${report.outputWarmupPath || 'NÃO GERADO'}`);
  console.log(`Report output: ${report.outputReportPath}`);
  console.log('');
  console.log('Mensagem:');
  console.log(report.message);
  if (report.extractorCommand) {
    console.log('');
    console.log('Comando de extração Gemini:');
    console.log(report.extractorCommand);
  }
  console.log('');
  console.log('Governança:');
  console.log('PaperOnly=true');
  console.log('LiveMoneyAuthorization=false');
  console.log('AutomaticExecutionAllowed=false');
  console.log('AutomaticBetExecutionAllowed=false');
}

function main() {
  const input = parseArgs(process.argv);
  const gateway = new WarmupScreenshotImportGateway({
    screenshotDir: input.screenshotDir,
    outputDir: input.outputDir,
    minimumRounds: input.minimumRounds,
  });

  const result = gateway.import({
    screenshotPath: input.screenshotPath,
    extractedJsonPath: input.extractedJsonPath,
    extractedPayload: input.extractedPayload,
  });

  if (!result.ok) {
    console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (input.format === 'json') {
    console.log(JSON.stringify({ ok: true, report: result.value }, null, 2));
  } else {
    printText(result.value);
  }

  if (result.value.status === 'WARMUP_SCREENSHOT_BLOCKED') {
    process.exitCode = 1;
  }
}

main();
