import test from "node:test";
import assert from "node:assert/strict";
import { AssistedRuntimeCommandAdapter } from "../dist/application/runtime/AssistedRuntimeCommandAdapter.js";

test("parses start command", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("start", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.accepted, true);
  assert.equal(result.command.type, "START");
});

test("parses win command with amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("win 25", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.command.type, "WIN");
  assert.equal(result.command.amount, 25);
});

test("parses loss command with comma decimal", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("loss 10,5", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.command.type, "LOSS");
  assert.equal(result.command.amount, 10.5);
});

test("rejects empty input", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("   ", 1000);

  assert.equal(result.status, "EMPTY_INPUT");
  assert.equal(result.accepted, false);
});

test("rejects unknown command", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("bet 10", 1000);

  assert.equal(result.status, "UNKNOWN_COMMAND");
  assert.equal(result.accepted, false);
});

test("rejects win without amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("win", 1000);

  assert.equal(result.status, "INVALID_AMOUNT");
  assert.equal(result.accepted, false);
});

test("rejects negative loss amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("loss -5", 1000);

  assert.equal(result.status, "INVALID_AMOUNT");
  assert.equal(result.accepted, false);
});

test("generates deterministic id for same normalized input and timestamp", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const first = adapter.parse(" WIN 25 ", 1000);
  const second = adapter.parse("win 25", 1000);

  assert.equal(first.command.id, second.command.id);
});
