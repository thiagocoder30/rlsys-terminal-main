#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SUMMARY_KEYS = new Set([
  'tests',
  'suites',
  'pass',
  'fail',
  'cancelled',
  'skipped',
  'todo',
  'duration_ms',
]);

function parseNumericValue(rawValue) {
  const parsed = Number(String(rawValue).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSummaryLine(line) {
  return String(line || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^ℹ\s*/, '')
    .replace(/^info\s+/i, '');
}

function parseNodeTestSummary(rawOutput) {
  const summary = {
    tests: null,
    suites: null,
    pass: null,
    fail: null,
    cancelled: null,
    skipped: null,
    todo: null,
    duration_ms: null,
  };

  const lines = String(rawOutput || '').split(/\r?\n/);

  for (const line of lines) {
    const normalized = normalizeSummaryLine(line);
    const match = normalized.match(/^([a-z_]+)\s+([0-9]+(?:\.[0-9]+)?)$/i);

    if (!match) {
      continue;
    }

    const key = match[1].toLowerCase();

    if (!SUMMARY_KEYS.has(key)) {
      continue;
    }

    summary[key] = parseNumericValue(match[2]);
  }

  return summary;
}

function formatSummaryLines(summary) {
  return [
    `GlobalTestTotal=${summary.tests === null ? 'UNKNOWN' : summary.tests}`,
    `GlobalTestPass=${summary.pass === null ? 'UNKNOWN' : summary.pass}`,
    `GlobalTestFail=${summary.fail === null ? 'UNKNOWN' : summary.fail}`,
  ];
}

if (require.main === module) {
  const filePath = process.argv[2];
  const input = filePath ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(0, 'utf8');
  const summary = parseNodeTestSummary(input);

  for (const line of formatSummaryLines(summary)) {
    console.log(line);
  }
}

module.exports = {
  parseNodeTestSummary,
  formatSummaryLines,
  normalizeSummaryLine,
};
