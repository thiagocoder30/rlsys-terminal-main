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
