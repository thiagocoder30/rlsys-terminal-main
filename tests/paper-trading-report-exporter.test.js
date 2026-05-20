const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PaperTradingReportExporter,
} = require('../dist/domain/reporting');

test('PaperTradingReportExporter exports institutional markdown, csv and jsonl', () => {
  const exporter = new PaperTradingReportExporter();

  const bundle = exporter.export([
    {
      sequence: 1,
      timestampEpochMs: 1000,
      verdict: 'NO_GO',
      reason: 'SNAPSHOT_REVIEW',
      paperBalance: 1000,
      drawdown: 0,
      theoreticalPnl: 0,
      latencyMs: 12,
    },
    {
      sequence: 2,
      timestampEpochMs: 2000,
      verdict: 'ALLOW',
      reason: 'PAPER_ONLY',
      paperBalance: 1010,
      drawdown: 0,
      theoreticalPnl: 10,
      latencyMs: 15,
    },
  ]);

  assert.equal(bundle.summary.eventCount, 2);
  assert.equal(bundle.summary.initialBalance, 1000);
  assert.equal(bundle.summary.finalBalance, 1010);
  assert.equal(bundle.summary.netPnl, 10);
  assert.match(bundle.markdown, /RL\.SYS CORE/);
  assert.match(bundle.csv, /sequence,timestampEpochMs,verdict/);
  assert.match(bundle.jsonl, /"verdict":"NO_GO"/);
});

test('PaperTradingReportExporter escapes CSV reasons safely', () => {
  const exporter = new PaperTradingReportExporter();

  const bundle = exporter.export([
    {
      sequence: 1,
      timestampEpochMs: 1000,
      verdict: 'FREEZE',
      reason: 'OCR said "timeout", review required',
      paperBalance: 980,
      drawdown: 20,
      theoreticalPnl: -20,
      latencyMs: 500,
    },
  ]);

  assert.match(bundle.csv, /"OCR said ""timeout"", review required"/);
  assert.equal(bundle.summary.freezeCount, 1);
  assert.match(bundle.markdown, /defensive protection states/);
});

test('PaperTradingReportExporter handles empty event set without throwing', () => {
  const exporter = new PaperTradingReportExporter();

  const bundle = exporter.export([]);

  assert.equal(bundle.summary.eventCount, 0);
  assert.equal(bundle.summary.finalBalance, 0);
  assert.match(bundle.markdown, /No paper trading events/);
  assert.equal(bundle.csv.split('\n')[0], 'sequence,timestampEpochMs,verdict,reason,paperBalance,drawdown,theoreticalPnl,latencyMs');
  assert.equal(bundle.jsonl, '');
});
