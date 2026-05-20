const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('main entrypoint wires RuntimeKernel and JsonLinesReplayRepository', () => {
  const source = readFileSync('src/main.ts', 'utf8');

  assert.match(source, /RuntimeKernel/);
  assert.match(source, /JsonLinesReplayRepository/);
  assert.match(source, /node:readline\/promises/);
  assert.match(source, /data/);
  assert.match(source, /replay/);
});

test('main entrypoint keeps text-only institutional REPL contract', () => {
  const source = readFileSync('src/main.ts', 'utf8');

  assert.match(source, /status/);
  assert.match(source, /quit/);
  assert.match(source, /rlsys>/);
  assert.doesNotMatch(source, /websocket/i);
  assert.doesNotMatch(source, /react/i);
});
