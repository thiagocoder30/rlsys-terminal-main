const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');

test('local rlsys alias delegates to remote sprint loader', () => {
  const source = readFileSync('install/bootstrap/rlsys', 'utf8');

  assert.match(source, /rlsys-install\.sh/);
  assert.match(source, /exec "\$LOADER" "\$@"/);
});

test('local rlsys alias is executable', () => {
  const mode = statSync('install/bootstrap/rlsys').mode;

  assert.ok((mode & 0o111) !== 0);
});

test('bootstrap README documents remote and local modes', () => {
  const source = readFileSync('install/bootstrap/README.md', 'utf8');

  assert.match(source, /Remote one-line mode/);
  assert.match(source, /Local alias mode/);
  assert.match(source, /install\/bootstrap\/rlsys sprint-056/);
});
