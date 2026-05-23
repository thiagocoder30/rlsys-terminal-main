#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-085-institutional-module-guard-fix"
COMMIT_MSG="chore(runtime): replace unsafe esm migration with compatibility guard"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 085 V4: Institutional Module Guard Fix =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main
git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

for branch in \
  sprint-085-runtime-packaging-esm-standardization \
  sprint-085-safe-test-module-standardization \
  sprint-085-module-compatibility-guard \
  sprint-085-institutional-module-guard-fix
do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch -D "$branch"
  fi
done

git checkout -b "$BRANCH"

mkdir -p install/quality
mkdir -p tests

# Remove unsafe leftovers from failed ESM migration attempts.
rm -f tests/runtime-package-esm-standardization.test.js
rm -f install/quality/check-esm-package.js

node <<'NODE'
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

delete pkg.type;
delete pkg.exports;

if (!pkg.scripts) {
  pkg.scripts = {};
}

delete pkg.scripts["check:package"];

pkg.scripts["check:modules"] = "node install/quality/check-module-compatibility.cjs";

fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
NODE

cat > install/quality/check-module-compatibility.cjs <<'JS'
const { readFileSync, readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const failures = [];
const warnings = [];

if (pkg.type === "module") {
  failures.push('Unsafe global ESM detected: package.json must not define "type": "module" yet.');
}

if (pkg.exports) {
  failures.push("Unsafe package exports detected: exports must wait for a complete build/test migration.");
}

if (pkg.scripts?.["check:package"]) {
  failures.push('Obsolete script detected: scripts["check:package"] must be removed.');
}

if (pkg.scripts?.["check:modules"] !== "node install/quality/check-module-compatibility.cjs") {
  failures.push('Missing scripts["check:modules"] compatibility guard.');
}

if (existsSync("tests/runtime-package-esm-standardization.test.js")) {
  failures.push("Obsolete failing test still exists: tests/runtime-package-esm-standardization.test.js");
}

if (existsSync("install/quality/check-esm-package.js")) {
  failures.push("Obsolete unsafe ESM check still exists: install/quality/check-esm-package.js");
}

for (const file of readdirSync("tests")) {
  if (!file.endsWith(".test.js")) {
    continue;
  }

  const fullPath = join("tests", file);
  const content = readFileSync(fullPath, "utf8");

  const usesImport = /^\s*import\s+/m.test(content);
  const usesRequire = /\brequire\s*\(/.test(content);

  if (usesImport && usesRequire) {
    failures.push(`${fullPath} mixes ESM import and CommonJS require.`);
  }

  if (usesImport) {
    warnings.push(`${fullPath} uses ESM import under typeless package; warning is accepted until full migration.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[MODULE COMPATIBILITY CHECK] ${failure}`);
  }

  process.exit(1);
}

for (const warning of warnings.slice(0, 8)) {
  console.warn(`[MODULE COMPATIBILITY CHECK][WARN] ${warning}`);
}

if (warnings.length > 8) {
  console.warn(`[MODULE COMPATIBILITY CHECK][WARN] ${warnings.length - 8} additional warning(s) omitted.`);
}

console.log("[MODULE COMPATIBILITY CHECK] current module layout is institutionally safe.");
JS

cat > tests/module-compatibility-guard.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");

test("package avoids unsafe global ESM until full migration", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  assert.equal(Object.prototype.hasOwnProperty.call(pkg, "type"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pkg, "exports"), false);
});

test("module compatibility guard is registered", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  assert.equal(
    pkg.scripts["check:modules"],
    "node install/quality/check-module-compatibility.cjs",
  );
});

test("obsolete unsafe ESM migration artifacts are absent", () => {
  assert.equal(existsSync("tests/runtime-package-esm-standardization.test.js"), false);
  assert.equal(existsSync("install/quality/check-esm-package.js"), false);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add -A \
  package.json \
  package-lock.json \
  install/quality \
  tests \
  install/sprints/run-sprint-085.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 085 institutional module guard fix"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 085 completed, merged and pushed successfully =="
