#!/usr/bin/env node
'use strict';

const os = require('node:os');
const path = require('node:path');
const { InstitutionalMemoryRepository } = require('../dist/infrastructure/paper-operational/institutional-memory-repository');

async function main() {
  const rootDir = process.env.RLSYS_MEMORY_REPOSITORY_DIR
    || path.join(os.tmpdir(), `rlsys-memory-demo-${Date.now()}`);

  const repository = new InstitutionalMemoryRepository({
    rootDir,
    maxSessionFileBytes: 128000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  const layout = await repository.ensureLayout();

  if (!layout.ok) {
    console.error(JSON.stringify(layout.error, null, 2));
    process.exitCode = 1;
    return;
  }

  const saved = await repository.saveSession({
    sessionId: 'paper-memory-demo',
    tableId: 'mesa-demo',
    strategyId: 'fusion',
    startedAtEpochMs: 1717200060000,
    finishedAtEpochMs: 1717200160000,
    roundCount: 24,
    finalStatus: 'PAPER_FAVORAVEL',
    finalConfidence: 86.4,
    suggestionCount: 4,
    favorableSuggestionCount: 2,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    notes: ['Sessão exportada para laboratório institucional.'],
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  if (!saved.ok) {
    console.error(JSON.stringify(saved.error, null, 2));
    process.exitCode = 1;
    return;
  }

  const index = await repository.saveIndex('strategy-reputation-fusion', {
    key: 'strategy:fusion',
    updatedAtEpochMs: 1717200160000,
    sampleSize: 1,
    score: 0.86,
    suggestedWeight: 1.12,
    decision: 'REPUTATION_STRONG',
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  if (!index.ok) {
    console.error(JSON.stringify(index.error, null, 2));
    process.exitCode = 1;
    return;
  }

  const listed = await repository.listSessionIds();

  if (!listed.ok) {
    console.error(JSON.stringify(listed.error, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    rootDir,
    sessions: listed.value,
    index: index.value.key,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
