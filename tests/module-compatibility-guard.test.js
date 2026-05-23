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
