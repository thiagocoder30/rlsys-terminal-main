const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('remote sprint loader exists and uses GitHub raw scripts', () => {
  const source = readFileSync('install/bootstrap/rlsys-install.sh', 'utf8');

  assert.match(source, /raw\.githubusercontent\.com/);
  assert.match(source, /install\/sprints/);
  assert.match(source, /install\/manifests/);
  assert.match(source, /sha256sum/);
  assert.match(source, /curl -fsSL/);
});

test('remote sprint loader keeps project-local cache contract', () => {
  const source = readFileSync('install/bootstrap/rlsys-install.sh', 'utf8');

  assert.match(source, /RLSYS_INSTALL_CACHE/);
  assert.match(source, /\.rlsys-install-cache/);
  assert.match(source, /rlsys-install-\$\{SPRINT\}\.log/);
});
