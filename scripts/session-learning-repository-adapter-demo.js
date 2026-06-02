#!/usr/bin/env node
'use strict';

const os = require('node:os');
const path = require('node:path');
const { InstitutionalMemoryRepository } = require('../dist/infrastructure/paper-operational/institutional-memory-repository');
const { SessionLearningRepositoryAdapter } = require('../dist/infrastructure/paper-operational/session-learning-repository-adapter');

async function main() {
  const rootDir = process.env.RLSYS_MEMORY_REPOSITORY_DIR
    || path.join(os.tmpdir(), `rlsys-learning-adapter-demo-${Date.now()}`);

  const repository = new InstitutionalMemoryRepository({
    rootDir,
    maxSessionFileBytes: 128000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  const adapter = new SessionLearningRepositoryAdapter(repository);

  const result = await adapter.learnAndPersist({
    sessionId: 'paper-learning-adapter-demo',
    tableId: 'mesa-demo',
    strategyId: 'fusion',
    startedAtEpochMs: 1717200060000,
    finishedAtEpochMs: 1717200160000,
    roundCount: 24,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    suggestions: [
      { status: 'PAPER_FAVORAVEL', finalConfidence: 86, manualUseAllowed: true, occurredAtEpochMs: 1717200070000 },
      { status: 'PAPER_OBSERVAR', finalConfidence: 72, manualUseAllowed: false, occurredAtEpochMs: 1717200080000 },
      { status: 'PAPER_CERTIFICADO', finalConfidence: 89, manualUseAllowed: true, occurredAtEpochMs: 1717200090000 },
    ],
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  if (!result.ok) {
    console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
    process.exitCode = 1;
    return;
  }

  const listed = await repository.listSessionIds();

  if (!listed.ok) {
    console.error(JSON.stringify({ ok: false, error: listed.error }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    rootDir,
    savedSessionId: result.value.savedSessionId,
    savedStrategyIndex: result.value.savedStrategyIndex,
    savedTableIndex: result.value.savedTableIndex,
    sessions: listed.value,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
