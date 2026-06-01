const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperSessionJournalEngine,
} = require('../dist/domain/bankroll/paper-session-journal-engine');

test('PaperSessionJournalEngine appends first PAPER session event', () => {
  const result = new PaperSessionJournalEngine().append({
    sessionId: 'paper-session-184',
    eventId: 'event-start-184',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000000,
    summary: 'Sessão PAPER iniciada.',
    maxEvents: 10,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_SESSION_JOURNAL_APPENDED');
  assert.equal(result.value.event.sequence, 1);
  assert.equal(result.value.journal.totalEvents, 1);
  assert.equal(result.value.journal.events.length, 1);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperSessionJournalEngine appends sequential events without infrastructure dependency', () => {
  const engine = new PaperSessionJournalEngine();

  const first = engine.append({
    sessionId: 'paper-session-184-seq',
    eventId: 'event-start-seq-184',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000001,
    summary: 'Sessão iniciada.',
    maxEvents: 10,
  });

  assert.equal(first.ok, true);

  const second = engine.append({
    sessionId: 'paper-session-184-seq',
    eventId: 'event-risk-seq-184',
    type: 'RISK_EVALUATED',
    occurredAtEpochMs: 1717200000002,
    summary: 'Risk Guard avaliado.',
    maxEvents: 10,
    previousJournal: first.value.journal,
  });

  assert.equal(second.ok, true);
  assert.equal(second.value.event.sequence, 2);
  assert.equal(second.value.journal.totalEvents, 2);
  assert.equal(second.value.journal.events.length, 2);
});

test('PaperSessionJournalEngine replays identical event idempotently', () => {
  const engine = new PaperSessionJournalEngine();
  const input = {
    sessionId: 'paper-session-184-replay',
    eventId: 'event-replay-184',
    type: 'PAPER_ENTRY_OPENED',
    occurredAtEpochMs: 1717200000003,
    summary: 'Entrada PAPER aberta manualmente.',
    maxEvents: 10,
  };

  const first = engine.append(input);
  assert.equal(first.ok, true);

  const replay = engine.append({
    ...input,
    previousJournal: first.value.journal,
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_SESSION_JOURNAL_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.event, first.value.event);
  assert.deepEqual(replay.value.journal, first.value.journal);
});

test('PaperSessionJournalEngine rejects duplicate eventId conflict', () => {
  const engine = new PaperSessionJournalEngine();

  const first = engine.append({
    sessionId: 'paper-session-184-conflict',
    eventId: 'event-conflict-184',
    type: 'PAPER_TRADE_SETTLED',
    occurredAtEpochMs: 1717200000004,
    summary: 'Trade PAPER liquidado.',
    maxEvents: 10,
  });

  assert.equal(first.ok, true);

  const conflict = engine.append({
    sessionId: 'paper-session-184-conflict',
    eventId: 'event-conflict-184',
    type: 'SESSION_FINISHED',
    occurredAtEpochMs: 1717200000004,
    summary: 'Sessão PAPER finalizada.',
    maxEvents: 10,
    previousJournal: first.value.journal,
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.reason, 'DUPLICATE_JOURNAL_EVENT_CONFLICT');
  assert.equal(conflict.error.productionMoneyAllowed, false);
  assert.equal(conflict.error.liveMoneyAuthorization, false);
});

test('PaperSessionJournalEngine keeps bounded journal for low-memory devices', () => {
  const engine = new PaperSessionJournalEngine();

  const first = engine.append({
    sessionId: 'paper-session-184-bounded',
    eventId: 'event-1-184',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000005,
    summary: 'Primeiro evento.',
    maxEvents: 2,
  });

  assert.equal(first.ok, true);

  const second = engine.append({
    sessionId: 'paper-session-184-bounded',
    eventId: 'event-2-184',
    type: 'RISK_EVALUATED',
    occurredAtEpochMs: 1717200000006,
    summary: 'Segundo evento.',
    maxEvents: 2,
    previousJournal: first.value.journal,
  });

  assert.equal(second.ok, true);

  const third = engine.append({
    sessionId: 'paper-session-184-bounded',
    eventId: 'event-3-184',
    type: 'SESSION_FINISHED',
    occurredAtEpochMs: 1717200000007,
    summary: 'Terceiro evento.',
    maxEvents: 2,
    previousJournal: second.value.journal,
  });

  assert.equal(third.ok, true);
  assert.equal(third.value.reason, 'PAPER_SESSION_JOURNAL_BOUNDED_APPEND');
  assert.equal(third.value.journal.totalEvents, 3);
  assert.equal(third.value.journal.events.length, 2);
  assert.equal(third.value.journal.events[0].eventId, 'event-2-184');
  assert.equal(third.value.journal.events[1].eventId, 'event-3-184');
});

test('PaperSessionJournalEngine rejects live money flags', () => {
  const result = new PaperSessionJournalEngine().append({
    sessionId: 'paper-session-184-live',
    eventId: 'event-live-184',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000008,
    summary: 'Sessão PAPER iniciada.',
    maxEvents: 10,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
});

test('PaperSessionJournalEngine rejects malformed input without silent failure', () => {
  const result = new PaperSessionJournalEngine().append({
    sessionId: 'x',
    eventId: 'event-invalid-184',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000009,
    summary: 'Sessão PAPER iniciada.',
    maxEvents: 10,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_SESSION_JOURNAL_INPUT');
});
