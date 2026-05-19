const test = require('node:test');
const assert = require('node:assert');

const { LiveSessionCoordinator } = require('../dist/application/live/LiveSessionCoordinator');
const { DefenseStatus } = require('../dist/application/live/IntegrationPorts');
const { ActionSignal } = require('../dist/domain/decision/DecisionContracts');

function buildCoordinator(overrides = {}) {
  const healthGuard = {
    checkHealth: () => overrides.healthStatus || DefenseStatus.CLEAR
  };

  const financialGuard = {
    authorizeEntry: () => overrides.financialStatus || DefenseStatus.CLEAR,
    registerPnL: () => undefined,
    getConsecutiveLosses: () => 0
  };

  const cooldownGuard = {
    isOperatorReady: () => overrides.cooldownStatus || DefenseStatus.CLEAR,
    triggerCooldown: () => undefined
  };

  let tacticalCalls = 0;
  const tacticalEngine = {
    evaluate: () => {
      tacticalCalls += 1;
      return {
        action: ActionSignal.NO_GO,
        expectedEV: 0,
        confidence: 0,
        reason: 'TACTICAL_NO_GO'
      };
    }
  };

  return {
    coordinator: new LiveSessionCoordinator(
      healthGuard,
      financialGuard,
      cooldownGuard,
      tacticalEngine
    ),
    getTacticalCalls: () => tacticalCalls
  };
}

function liveState() {
  return {
    dealerId: 'dealer-test',
    wheelSpeedCategory: 'NORMAL',
    targetSector: 1
  };
}

test('LiveSessionCoordinator blocks through RuntimeEnforcementOrchestrator when cooldown is active', () => {
  const fixture = buildCoordinator({ cooldownStatus: DefenseStatus.BLOCKED });

  const decision = fixture.coordinator.processLiveSpin(liveState(), 1000);

  assert.equal(decision.action, ActionSignal.NO_GO);
  assert.match(decision.reason, /^RUNTIME_ENFORCEMENT_NO_GO_/);
  assert.equal(fixture.getTacticalCalls(), 0);
});

test('LiveSessionCoordinator blocks through RuntimeEnforcementOrchestrator when health is down', () => {
  const fixture = buildCoordinator({ healthStatus: DefenseStatus.BLOCKED });

  const decision = fixture.coordinator.processLiveSpin(liveState(), 1000);

  assert.equal(decision.action, ActionSignal.NO_GO);
  assert.match(decision.reason, /^RUNTIME_ENFORCEMENT_FREEZE_/);
  assert.equal(fixture.getTacticalCalls(), 0);
});

test('LiveSessionCoordinator still reaches tactical engine when enforcement allows', () => {
  const fixture = buildCoordinator();

  const decision = fixture.coordinator.processLiveSpin(liveState(), 1000);

  assert.equal(decision.action, ActionSignal.NO_GO);
  assert.equal(decision.reason, 'TACTICAL_NO_GO');
  assert.equal(fixture.getTacticalCalls(), 1);
});
