import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeHudLiveRenderer } from "../dist/application/runtime/RuntimeHudLiveRenderer.js";

function snapshot() {
  return {
    bankroll: 1125,
    initialBankroll: 1000,
    profitLocked: 80,
    drawdown: 20,
    cooldownActive: false,
    riskState: "SAFE",
    sessionState: "RUNNING",
    lastAction: "WIN 25",
    updatedAtEpochMs: 1000,
  };
}

test("renders full assisted runtime HUD", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render(snapshot(), { width: 60 });

  assert.equal(result.lineCount, 13);
  assert.match(result.text, /RL\.SYS CORE/);
  assert.match(result.text, /Bankroll/);
  assert.match(result.text, /1125\.00/);
  assert.match(result.text, /\+125\.00/);
});

test("renders compact HUD for tmux panes", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render(snapshot(), { compact: true });

  assert.equal(result.lineCount, 3);
  assert.match(result.text, /RL\.SYS/);
  assert.match(result.text, /bankroll=1125\.00/);
  assert.match(result.text, /cooldown=OFF/);
});

test("renders negative net result with sign", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render({
    ...snapshot(),
    bankroll: 940,
  });

  assert.match(result.text, /-60\.00/);
});

test("rejects invalid numeric values", () => {
  const renderer = new RuntimeHudLiveRenderer();

  assert.throws(
    () => renderer.render({
      ...snapshot(),
      bankroll: Number.NaN,
    }),
    /bankroll must be finite/,
  );
});

test("rejects empty last action", () => {
  const renderer = new RuntimeHudLiveRenderer();

  assert.throws(
    () => renderer.render({
      ...snapshot(),
      lastAction: "   ",
    }),
    /lastAction cannot be empty/,
  );
});
