const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeMemoryPressureClassifierV2,
  createMobileMemoryPressurePolicyV2,
} = require("../dist/application/runtime/RuntimeMemoryPressureClassifierV2.js");

function sample(overrides = {}) {
  return {
    heapUsedBytes: 700,
    heapTotalBytes: 1000,
    rssBytes: 1000,
    baselineHeapUsedBytes: 600,
    ...overrides,
  };
}

test("classifies low pressure under calibrated baseline", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({ heapUsedBytes: 500, heapTotalBytes: 1000 }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "LOW");
});

test("downgrades high ratio to elevated when absolute pressure is low", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 900,
      heapTotalBytes: 1000,
      baselineHeapUsedBytes: 850,
      rssBytes: 20 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "ELEVATED");
  assert.match(result.reasons.join(" "), /without absolute pressure/);
});

test("classifies high when ratio is confirmed by heap drift", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 30 * 1024 * 1024,
      heapTotalBytes: 32 * 1024 * 1024,
      baselineHeapUsedBytes: 1 * 1024 * 1024,
      rssBytes: 100 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "HIGH");
});

test("classifies critical when ratio is confirmed by critical drift", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 64 * 1024 * 1024,
      heapTotalBytes: 66 * 1024 * 1024,
      baselineHeapUsedBytes: 1 * 1024 * 1024,
      rssBytes: 100 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "CRITICAL");
});

test("classifies high when ratio is confirmed by rss", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 900,
      heapTotalBytes: 1000,
      baselineHeapUsedBytes: 850,
      rssBytes: 600 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "HIGH");
});

test("rejects invalid threshold ordering", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  assert.throws(
    () => classifier.classify(sample(), {
      ...createMobileMemoryPressurePolicyV2(),
      elevatedHeapRatio: 0.9,
      highHeapRatio: 0.8,
    }),
    /thresholds must be ordered/,
  );
});
