const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');

test('installer registry declares sprint 057 metadata', () => {
  const registry = JSON.parse(readFileSync('install/registry/sprints.json', 'utf8'));

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.defaultChannel, 'stable');
  assert.equal(registry.sprints['sprint-057'].script, 'run-sprint-057.sh');
  assert.equal(registry.sprints['sprint-057'].channel, 'stable');
});

test('remote loader resolves script names from local registry when available', () => {
  const source = readFileSync('install/bootstrap/rlsys-install.sh', 'utf8');

  assert.match(source, /install\/registry\/sprints\.json/);
  assert.match(source, /RESOLVED_SCRIPT/);
  assert.match(source, /SCRIPT_NAME="\$RESOLVED_SCRIPT"/);
});

test('sprint 057 installer artifact exists and is executable', () => {
  const mode = statSync('install/sprints/run-sprint-057.sh').mode;

  assert.ok((mode & 0o111) !== 0);
});

test('gitignore allows institutional sprint artifacts while keeping root scripts ignored', () => {
  const source = readFileSync('.gitignore', 'utf8');

  assert.match(source, /!install\/sprints\/run-sprint-\*\.sh/);
});
