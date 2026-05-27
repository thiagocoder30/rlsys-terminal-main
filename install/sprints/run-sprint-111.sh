#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT_ID="111"
BRANCH="sprint-111-module-type-hygiene"
COMMIT_MSG="chore(runtime): declare package module type hygiene"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_DIR="/sdcard/Download"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

copy_log() {
  if [ -d "$DOWNLOAD_DIR" ]; then
    cp "$LOG_FILE" "$DOWNLOAD_DIR/" || true
    echo "Log copiado para: ${DOWNLOAD_DIR}/$(basename "$LOG_FILE")"
  fi
}

fail() {
  local exit_code="$1"
  local line_no="$2"

  echo
  echo "== SPRINT ${SPRINT_ID} FALHOU =="
  echo "Exit code: ${exit_code}"
  echo "Linha: ${line_no}"
  echo "Log: ${LOG_FILE}"

  copy_log

  exit "$exit_code"
}

success() {
  echo
  echo "== SPRINT ${SPRINT_ID} CONCLUÍDA COM SUCESSO =="
  echo "Log: ${LOG_FILE}"

  copy_log
}

trap 'fail "$?" "$LINENO"' ERR

echo "== RL.SYS CORE :: Sprint 111 =="
echo "== Module Type Hygiene pós-release v1.0 =="
echo "Run ID: ${RUN_ID}"

git fetch origin main --tags || true

git checkout main
git pull origin main || true

git checkout -B "$BRANCH"

mkdir -p docs/architecture
mkdir -p tools
mkdir -p tests

cat > tools/module-type-audit.js <<'JS'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'logs',
  'data',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(absolute);
    }
  }
}

function hasCommonJsSyntax(source) {
  return (
    /\brequire\s*\(/.test(source) ||
    /\bmodule\.exports\b/.test(source) ||
    /\bexports\.[A-Za-z0-9_$]+\b/.test(source)
  );
}

function hasEsmSyntax(source) {
  return (
    /^\s*import\s.+from\s+['"][^'"]+['"];?/m.test(source) ||
    /^\s*export\s+/m.test(source)
  );
}

function main() {
  const packageJsonPath = path.join(ROOT, 'package.json');

  const packageJson = readJson(packageJsonPath);

  const files = [];

  walk(ROOT, files);

  const esmFiles = [];
  const commonJsFiles = [];
  const mixedFiles = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');

    const relative = path.relative(ROOT, file);

    const usesCjs = hasCommonJsSyntax(source);
    const usesEsm = hasEsmSyntax(source);

    if (usesCjs) {
      commonJsFiles.push(relative);
    }

    if (usesEsm) {
      esmFiles.push(relative);
    }

    if (usesCjs && usesEsm) {
      mixedFiles.push(relative);
    }
  }

  const report = {
    packageType: packageJson.type || null,
    scannedJavaScriptFiles: files.length,
    commonJsFiles: commonJsFiles.length,
    esmFiles: esmFiles.length,
    mixedFiles,
    recommendation:
      packageJson.type === 'commonjs'
        ? 'root package explicitly declares CommonJS runtime semantics'
        : 'root package should explicitly declare CommonJS',
  };

  console.log(JSON.stringify(report, null, 2));

  if (mixedFiles.length > 0) {
    console.error(
      'Module type audit failed: mixed CommonJS/ESM files detected.',
    );

    process.exit(1);
  }

  if (packageJson.type !== 'commonjs') {
    console.error(
      'Module type audit failed: package.json must explicitly declare type commonjs.',
    );

    process.exit(1);
  }
}

main();
JS

cat > docs/architecture/module-type-hygiene.md <<'MD'
# RL.SYS CORE — Module Type Hygiene

## Decisão arquitetural

O RL.SYS CORE usa runtime operacional baseado em CommonJS.

Após a release v1.0-paper-runtime, esta sprint torna a semântica de módulo explícita.

O package raiz agora declara:

type: commonjs

## Motivo

Preservar compatibilidade com:

- scripts de instalação
- runtime do paper system
- testes node:test
- preloads do ledger
- preloads do discipline guard
- Termux/Proot

## Regras

- Não migrar para ESM nesta sprint.
- Nenhum gate operacional deve mudar.
- Nenhum runtime deve mudar.
- O domínio continua isolado.

## Critério de aceite

- npm run build verde
- npm test verde
- audit:module-type verde
- sem arquivos híbridos
MD

node <<'NODE'
const fs = require('node:fs');

const packagePath = 'package.json';

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, 'utf8'),
);

packageJson.type = 'commonjs';

packageJson.scripts = packageJson.scripts || {};

packageJson.scripts['audit:module-type'] =
  'node tools/module-type-audit.js';

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(packageJson, null, 2)}\n`,
);
NODE

cat > tests/module-type-hygiene.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function readPackageJson() {
  return JSON.parse(
    fs.readFileSync('package.json', 'utf8'),
  );
}

test(
  'package declares explicit CommonJS runtime semantics',
  () => {
    const packageJson = readPackageJson();

    assert.equal(packageJson.type, 'commonjs');

    assert.equal(
      packageJson.scripts['audit:module-type'],
      'node tools/module-type-audit.js',
    );
  },
);

test(
  'module type audit executes successfully',
  () => {
    const result = spawnSync(
      process.execPath,
      ['tools/module-type-audit.js'],
      {
        encoding: 'utf8',
        timeout: 5000,
      },
    );

    const output =
      `${result.stdout || ''}${result.stderr || ''}`;

    assert.equal(result.status, 0, output);

    assert.match(
      output,
      /root package explicitly declares CommonJS runtime semantics/,
    );
  },
);

test(
  'module hygiene documentation preserves architectural decision',
  () => {
    const doc = fs.readFileSync(
      'docs/architecture/module-type-hygiene.md',
      'utf8',
    );

    assert.match(doc, /type: commonjs/i);

    assert.match(
      doc,
      /Não migrar para ESM/i,
    );

    assert.match(
      doc,
      /Nenhum gate operacional deve mudar/i,
    );
  },
);
JS

echo
echo "== MODULE TYPE AUDIT =="

npm run audit:module-type

echo
echo "== BUILD =="

npm run build

echo
echo "== TESTES DIRECIONADOS =="

node --test tests/module-type-hygiene.test.js

echo
echo "== TESTES GLOBAIS =="

npm test

git add \
  package.json \
  tools/module-type-audit.js \
  docs/architecture/module-type-hygiene.md \
  tests/module-type-hygiene.test.js \
  install/sprints/run-sprint-111.sh

git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

git checkout main

git merge --no-edit "$BRANCH"

echo
echo "== VALIDAÇÃO FINAL MAIN =="

npm run audit:module-type
npm run build
npm test

git push origin main

trap - ERR

success
