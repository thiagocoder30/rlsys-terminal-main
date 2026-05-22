const test = require('node:test');
const assert = require('node:assert/strict');
const { GuidedOperationMode } = require('../dist/application/session');

test('GuidedOperationMode starts requiring setup when profile is missing', () => {
  const mode = new GuidedOperationMode(false);

  assert.equal(mode.current(), 'SETUP_REQUIRED');

  const rejected = mode.handle('START_SESSION');
  assert.equal(rejected.accepted, false);
  assert.match(rejected.nextAction, /setup/i);
});

test('GuidedOperationMode transitions from setup to ready when profile loads', () => {
  const mode = new GuidedOperationMode(false);

  const result = mode.handle('PROFILE_LOADED');

  assert.equal(result.accepted, true);
  assert.equal(result.state, 'READY_TO_START');
  assert.equal(mode.current(), 'READY_TO_START');
});

test('GuidedOperationMode starts active session from ready state', () => {
  const mode = new GuidedOperationMode(true);

  const result = mode.handle('START_SESSION');

  assert.equal(result.accepted, true);
  assert.equal(result.state, 'SESSION_ACTIVE');
  assert.match(result.message, /iniciada/);
});

test('GuidedOperationMode accepts win and loss during active session', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');

  assert.equal(mode.handle('REGISTER_WIN').accepted, true);
  assert.equal(mode.handle('REGISTER_LOSS').accepted, true);
  assert.equal(mode.current(), 'SESSION_ACTIVE');
});

test('GuidedOperationMode pauses and resumes active session', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');

  const paused = mode.handle('PAUSE_SESSION');
  assert.equal(paused.state, 'SESSION_PAUSED');

  const resumed = mode.handle('RESUME_SESSION');
  assert.equal(resumed.state, 'SESSION_ACTIVE');
});

test('GuidedOperationMode finishes session and allows final report', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');
  const finished = mode.handle('FINISH_SESSION');
  const report = mode.handle('GENERATE_REPORT');

  assert.equal(finished.state, 'SESSION_FINISHED');
  assert.equal(report.accepted, true);
  assert.match(report.message, /Relatório final/);
});

test('GuidedOperationMode reset returns to setup required', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');
  const reset = mode.handle('RESET');

  assert.equal(reset.state, 'SETUP_REQUIRED');
  assert.equal(mode.current(), 'SETUP_REQUIRED');
});
