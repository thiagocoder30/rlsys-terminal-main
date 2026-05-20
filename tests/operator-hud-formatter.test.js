const test = require('node:test');
const assert = require('node:assert/strict');
const { OperatorHudFormatter } = require('../dist/domain/operator');

test('OperatorHudFormatter renders minimal institutional CLI HUD', () => {
  const formatter = new OperatorHudFormatter();

  const output = formatter.render({
    verdict: 'NO_GO',
    reason: 'SNAPSHOT_REVOKED',
    paperBalance: 1000,
    drawdown: 0,
    snapshotStatus: 'REVIEW',
    runtimeStatus: 'HEALTHY',
    freezeStatus: 'OK',
    lastTrigger: 'ENTROPY_DRIFT',
    lastReason: 'Snapshot entropy drift exceeded tolerance',
    latencyMs: 12,
  });

  assert.match(output, /RL\.SYS CORE/);
  assert.match(output, /Estado: NO_GO/);
  assert.match(output, /Motivo: SNAPSHOT_REVOKED/);
  assert.match(output, /Paper Balance:/);
  assert.match(output, /Drawdown:/);
  assert.match(output, /Snapshot: REVIEW/);
  assert.match(output, /Runtime: HEALTHY/);
  assert.match(output, /Freeze: OK/);
  assert.match(output, /Último trigger: ENTROPY_DRIFT/);
  assert.match(output, /Latência: 12ms/);
  assert.match(output, /^╔/m);
  assert.match(output, /╚/m);
});

test('OperatorHudFormatter truncates long operational reasons without crashing', () => {
  const formatter = new OperatorHudFormatter();

  const output = formatter.render(
    {
      verdict: 'FREEZE',
      reason: 'EMERGENCY_CAPITAL_FREEZE_TRIGGERED_BY_RUNTIME_INFRASTRUCTURE_FAILURE',
      paperBalance: 950.25,
      drawdown: 49.75,
      snapshotStatus: 'SNAPSHOT_VALID',
      runtimeStatus: 'DEGRADED',
      freezeStatus: 'FREEZE_TRIGGERED',
      lastTrigger: 'EVENT_LOOP_LAG',
      lastReason: 'Event loop lag exceeded defensive runtime threshold',
      latencyMs: 84,
    },
    { width: 32 },
  );

  assert.match(output, /FREEZE/);
  assert.match(output, /…/);
  assert.doesNotThrow(() => output.split('\n'));
});
