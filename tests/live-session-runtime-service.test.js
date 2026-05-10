const test = require('node:test');
const assert = require('node:assert/strict');
const { LiveSessionRuntimeService } = require('../dist/application/session/LiveSessionRuntimeService');

test('LiveSessionRuntimeService collects rounds before decision readiness', () => {
  const service = new LiveSessionRuntimeService();
  const report = service.ingest({ sessionId: 'live-a', value: 12, eventId: 'a-1', bankroll: 1000 });

  assert.equal(report.service, 'LiveSessionRuntimeService');
  assert.equal(report.schemaVersion, '2.9.0');
  assert.equal(report.status, 'ACCEPTED');
  assert.equal(report.executiveSummary.liveRuntimeGate, 'INITIALIZING');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.equal(report.decision, undefined);
});

test('LiveSessionRuntimeService invokes decision layer after 100 rounds while keeping live gate blocked', () => {
  const service = new LiveSessionRuntimeService();
  let report;
  for (let index = 0; index < 100; index += 1) {
    report = service.ingest({ sessionId: 'live-b', value: index % 37, eventId: `b-${index}`, sequence: index, bankroll: 1000 });
  }

  assert.equal(report.status, 'ACCEPTED');
  assert.equal(report.snapshot.readyForDecision, true);
  assert.equal(report.executiveSummary.liveRuntimeGate, 'DECISION_READY');
  assert.ok(['NO_GO', 'OBSERVE', 'COOLDOWN', 'ARMED', 'SIGNAL'].includes(report.executiveSummary.operationalGate));
  assert.ok(report.decision);
  assert.ok(['NO_GO', 'OBSERVE', 'COOLDOWN', 'ARMED', 'SIGNAL'].includes(report.decision.decision.operationalGate));
  assert.equal(report.decision.decision.execution.liveStakeFraction, 0);
});

test('LiveSessionRuntimeService reports duplicate events idempotently', () => {
  const service = new LiveSessionRuntimeService();
  service.ingest({ sessionId: 'live-c', value: 2, eventId: 'dup' });
  const duplicate = service.ingest({ sessionId: 'live-c', value: 2, eventId: 'dup' });

  assert.equal(duplicate.status, 'DUPLICATE_IGNORED');
  assert.equal(duplicate.snapshot.roundCount, 1);
});

test('LiveSessionRuntimeService rejects malformed round input', () => {
  const service = new LiveSessionRuntimeService();
  const report = service.ingest({ sessionId: 'live-d', value: -1 });

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.executiveSummary.liveRuntimeGate, 'BLOCKED');
});
