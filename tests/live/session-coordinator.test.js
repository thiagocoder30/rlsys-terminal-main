const test = require('node:test');
const assert = require('node:assert');
const { LiveSessionCoordinator } = require('../../dist/application/live/LiveSessionCoordinator');
const { DefenseStatus } = require('../../dist/application/live/IntegrationPorts');
const { ActionSignal } = require('../../dist/domain/decision/DecisionContracts');

// Mocks otimizados (simulando a Fase 1 e 2)
const createMocks = () => ({
  healthGuard: { checkHealth: () => DefenseStatus.CLEAR },
  financialGuard: { authorizeEntry: () => DefenseStatus.CLEAR },
  cooldownGuard: { isOperatorReady: () => DefenseStatus.CLEAR },
  tacticalEngine: { evaluate: () => ({ action: ActionSignal.SIGNAL, expectedEV: 0.10, confidence: 0.90, reason: 'ALPHA_CONFIRMED' }) }
});

const mockLiveState = { dealerId: 'D_ALICE', wheelSpeedCategory: 'NORMAL', targetSector: 32 };

test('LiveCoordinator: Atravessa pipeline e devolve SIGNAL quando tudo está verde', () => {
  const mocks = createMocks();
  const coordinator = new LiveSessionCoordinator(mocks.healthGuard, mocks.financialGuard, mocks.cooldownGuard, mocks.tacticalEngine);
  
  const result = coordinator.processLiveSpin(mockLiveState, 1000);
  
  assert.strictEqual(result.action, ActionSignal.SIGNAL);
  assert.strictEqual(result.reason, 'ALPHA_CONFIRMED');
});

test('LiveCoordinator: Bloqueia na Camada 0 (Problema de Saúde do Sistema)', () => {
  const mocks = createMocks();
  mocks.healthGuard.checkHealth = () => DefenseStatus.BLOCKED; // Simula falha na câmera/freeze
  const coordinator = new LiveSessionCoordinator(mocks.healthGuard, mocks.financialGuard, mocks.cooldownGuard, mocks.tacticalEngine);
  
  const result = coordinator.processLiveSpin(mockLiveState, 1000);
  
  assert.strictEqual(result.action, ActionSignal.NO_GO);
  assert.strictEqual(result.reason, 'SYSTEM_HEALTH_COMPROMISED');
});

test('LiveCoordinator: Bloqueia na Camada 1 (Drawdown atingido)', () => {
  const mocks = createMocks();
  mocks.financialGuard.authorizeEntry = () => DefenseStatus.BLOCKED; // Banca em risco
  const coordinator = new LiveSessionCoordinator(mocks.healthGuard, mocks.financialGuard, mocks.cooldownGuard, mocks.tacticalEngine);
  
  const result = coordinator.processLiveSpin(mockLiveState, 1000);
  
  assert.strictEqual(result.action, ActionSignal.NO_GO);
  assert.strictEqual(result.reason, 'FINANCIAL_DRAWDOWN_OR_BREAKER_ACTIVE');
});

test('LiveCoordinator: Fail-Closed em caso de quebra de runtime', () => {
  const mocks = createMocks();
  mocks.tacticalEngine.evaluate = () => { throw new Error("Memória RAM Esgotada"); };
  const coordinator = new LiveSessionCoordinator(mocks.healthGuard, mocks.financialGuard, mocks.cooldownGuard, mocks.tacticalEngine);
  
  const result = coordinator.processLiveSpin(mockLiveState, 1000);
  
  assert.strictEqual(result.action, ActionSignal.NO_GO);
  assert.strictEqual(result.reason, 'UNEXPECTED_RUNTIME_EXCEPTION');
});
