const test = require('node:test');
const assert = require('node:assert');
const { EmergencyFreezeGuard } = require('../dist/domain/runtime/EmergencyFreezeGuard');
const { FreezeReason } = require('../dist/domain/runtime/TelemetryContracts');

const strictPolicy = {
  maxLatencyMs: 150,
  maxDroppedFrames: 5,
  minOcrConfidence: 0.95,
  maxHeartbeatAgeMs: 2000
};

const healthySnapshot = {
  latencyMs: 45,
  droppedFrames: 0,
  ocrConfidence: 0.99,
  lastHeartbeatAgeMs: 100
};

test('EmergencyGuard: Permite operacao com telemetria saudavel', () => {
  const result = EmergencyFreezeGuard.evaluate(healthySnapshot, strictPolicy);
  assert.strictEqual(result.isFrozen, false);
  assert.strictEqual(result.reason, FreezeReason.NONE);
});

test('EmergencyGuard: Congela por perda de Heartbeat (Morte do Sensor)', () => {
  const deadSnapshot = { ...healthySnapshot, lastHeartbeatAgeMs: 5000 };
  const result = EmergencyFreezeGuard.evaluate(deadSnapshot, strictPolicy);
  assert.strictEqual(result.isFrozen, true);
  assert.strictEqual(result.reason, FreezeReason.HEARTBEAT_LOST);
});

test('EmergencyGuard: Congela por cegueira do OCR (Baixa Confianca)', () => {
  const blindSnapshot = { ...healthySnapshot, ocrConfidence: 0.80 };
  const result = EmergencyFreezeGuard.evaluate(blindSnapshot, strictPolicy);
  assert.strictEqual(result.isFrozen, true);
  assert.strictEqual(result.reason, FreezeReason.OCR_BLINDNESS);
});

test('EmergencyGuard: Congela por alta latencia (Risco de delay na acao)', () => {
  const lagSnapshot = { ...healthySnapshot, latencyMs: 300 };
  const result = EmergencyFreezeGuard.evaluate(lagSnapshot, strictPolicy);
  assert.strictEqual(result.isFrozen, true);
  assert.strictEqual(result.reason, FreezeReason.HIGH_LATENCY);
});

test('EmergencyGuard: Avaliacao O(1) nao aloca memoria se saudavel', () => {
  const result1 = EmergencyFreezeGuard.evaluate(healthySnapshot, strictPolicy);
  const result2 = EmergencyFreezeGuard.evaluate(healthySnapshot, strictPolicy);
  // Garante que é a mesma referência estática na memória
  assert.strictEqual(result1, result2); 
});
