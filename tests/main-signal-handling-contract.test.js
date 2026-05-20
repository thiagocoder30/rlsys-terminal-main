const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('main entrypoint wires shutdown coordinator and process signals', () => {
  const source = readFileSync('src/main.ts', 'utf8');

  assert.match(source, /RuntimeShutdownCoordinator/);
  assert.match(source, /SIGINT/);
  assert.match(source, /SIGTERM/);
  assert.match(source, /uncaughtException/);
  assert.match(source, /unhandledRejection/);
  assert.match(source, /terminal\.once\('close'/);
});

test('main entrypoint remains terminal-only and replay-backed', () => {
  const source = readFileSync('src/main.ts', 'utf8');

  assert.match(source, /JsonLinesReplayRepository/);
  assert.match(source, /node:readline\/promises/);
  assert.match(source, /rlsys>/);
  assert.doesNotMatch(source, /websocket/i);
  assert.doesNotMatch(source, /react/i);
});
