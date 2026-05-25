'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveLedgerPath() {
  const envPath = process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH || process.env.PAPER_RUNTIME_LEDGER_PATH;

  if (envPath && envPath.trim().length > 0) {
    return envPath;
  }

  return path.join(process.cwd(), 'data', 'paper-runtime', 'paper-ledger.json');
}

function createEmptyLedger() {
  const now = new Date().toISOString();

  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    entries: [],
    summary: {
      wins: 0,
      losses: 0,
      balance: 0,
      peakBalance: 0,
      maxDrawdown: 0,
      totalCommands: 0
    }
  };
}

function readLedger(ledgerPath = resolveLedgerPath()) {
  try {
    if (!fs.existsSync(ledgerPath)) {
      return createEmptyLedger();
    }

    const raw = fs.readFileSync(ledgerPath, 'utf8').trim();

    if (raw.length === 0) {
      return createEmptyLedger();
    }

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createEmptyLedger();
    }

    if (!Array.isArray(parsed.entries)) {
      return createEmptyLedger();
    }

    return parsed;
  } catch {
    return createEmptyLedger();
  }
}

function writeLedger(ledger, ledgerPath = resolveLedgerPath()) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function parseAmount(value) {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return 1;
  }

  const parsed = Number(String(value).replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function recalculateSummary(entries) {
  let balance = 0;
  let peakBalance = 0;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;

  for (const entry of entries) {
    if (entry.type === 'WIN') {
      balance += entry.amount;
      wins += 1;
    }

    if (entry.type === 'LOSS') {
      balance -= entry.amount;
      losses += 1;
    }

    if (balance > peakBalance) {
      peakBalance = balance;
    }

    const drawdown = peakBalance - balance;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return {
    wins,
    losses,
    balance,
    peakBalance,
    maxDrawdown,
    totalCommands: entries.length
  };
}

function appendLedgerEntry(type, amount, ledgerPath = resolveLedgerPath()) {
  const normalizedType = String(type).toUpperCase();

  if (normalizedType !== 'WIN' && normalizedType !== 'LOSS') {
    return {
      ok: false,
      reason: 'INVALID_LEDGER_ENTRY_TYPE'
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      reason: 'INVALID_LEDGER_AMOUNT'
    };
  }

  const ledger = readLedger(ledgerPath);
  const now = new Date().toISOString();

  ledger.entries.push({
    id: `${now}-${ledger.entries.length + 1}`,
    type: normalizedType,
    amount,
    createdAt: now
  });

  ledger.updatedAt = now;
  ledger.summary = recalculateSummary(ledger.entries);

  writeLedger(ledger, ledgerPath);

  return {
    ok: true,
    ledger
  };
}

function formatLedgerSummary(ledger) {
  const summary = ledger.summary || recalculateSummary(ledger.entries || []);

  return [
    'RL.SYS PAPER LEDGER',
    `wins: ${summary.wins}`,
    `losses: ${summary.losses}`,
    `balance: ${summary.balance}`,
    `peakBalance: ${summary.peakBalance}`,
    `maxDrawdown: ${summary.maxDrawdown}`,
    `totalCommands: ${summary.totalCommands}`
  ].join('\n');
}

module.exports = {
  resolveLedgerPath,
  createEmptyLedger,
  readLedger,
  writeLedger,
  parseAmount,
  recalculateSummary,
  appendLedgerEntry,
  formatLedgerSummary
};
