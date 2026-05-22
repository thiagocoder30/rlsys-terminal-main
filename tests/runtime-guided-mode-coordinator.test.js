const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeGuidedModeCoordinator,
} = require('../dist/application/session');

test('RuntimeGuidedModeCoordinator starts requiring profile', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  assert.equal(coordinator.current(), 'SETUP_REQUIRED');

  const result = coordinator.handle({ type: 'START' });

  assert.equal(result.accepted, false);
  assert.equal(result.state, 'SETUP_REQUIRED');
  assert.match(result.runtimeEvent, /GUIDED_REJECTED/);
});

test('RuntimeGuidedModeCoordinator loads profile and starts session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  const loaded = coordinator.handle({ type: 'PROFILE_LOADED' });
  const started = coordinator.handle({ type: 'START' });

  assert.equal(loaded.accepted, true);
  assert.equal(started.accepted, true);
  assert.equal(started.state, 'SESSION_ACTIVE');
  assert.equal(started.runtimeEvent, 'GUIDED_ACCEPTED_START_SESSION');
});

test('RuntimeGuidedModeCoordinator accepts win and loss in active session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  assert.equal(coordinator.handle({ type: 'WIN' }).accepted, true);
  assert.equal(coordinator.handle({ type: 'LOSS' }).accepted, true);
  assert.equal(coordinator.current(), 'SESSION_ACTIVE');
});

test('RuntimeGuidedModeCoordinator pauses and resumes session', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  const paused = coordinator.handle({ type: 'PAUSE' });
  const resumed = coordinator.handle({ type: 'RESUME' });

  assert.equal(paused.state, 'SESSION_PAUSED');
  assert.equal(resumed.state, 'SESSION_ACTIVE');
});

test('RuntimeGuidedModeCoordinator generates report and finishes', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  coordinator.handle({ type: 'PROFILE_LOADED' });
  coordinator.handle({ type: 'START' });

  const report = coordinator.handle({ type: 'REPORT' });
  const finish = coordinator.handle({ type: 'FINISH' });

  assert.equal(report.accepted, true);
  assert.equal(finish.accepted, true);
  assert.equal(finish.state, 'SESSION_FINISHED');
});

test('RuntimeGuidedModeCoordinator rejects unknown input safely', () => {
  const coordinator = new RuntimeGuidedModeCoordinator();

  const result = coordinator.handle({ type: 'UNKNOWN' });

  assert.equal(result.accepted, false);
  assert.equal(result.runtimeEvent, 'GUIDED_UNKNOWN');
});
