const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeBaselinePolicyFactory,
} = require("../dist/application/runtime/RuntimeBaselineCertificationProfile.js");

test("creates mobile conservative baseline for Galaxy A10s class hardware", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("MOBILE_CONSERVATIVE");

  assert.equal(profile.kind, "MOBILE_CONSERVATIVE");
  assert.match(profile.label, /Galaxy A10s/);
  assert.equal(profile.hardwareClass, "mobile-low-memory");
  assert.equal(profile.policy.minimumIterations, 50000);
  assert.equal(profile.policy.maxPressureViolations, 0);
});

test("creates mobile balanced baseline", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("MOBILE_BALANCED");

  assert.equal(profile.kind, "MOBILE_BALANCED");
  assert.equal(profile.policy.minimumIterations, 100000);
  assert.equal(profile.policy.maxHeapDriftBytes, 24 * 1024 * 1024);
});

test("creates desktop balanced baseline", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("DESKTOP_BALANCED");

  assert.equal(profile.kind, "DESKTOP_BALANCED");
  assert.equal(profile.hardwareClass, "desktop");
  assert.equal(profile.policy.minimumIterations, 250000);
});

test("creates custom baseline profile", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.custom({
    label: "Custom lab profile",
    hardwareClass: "lab",
    recommendedUse: "Controlled soak certification.",
    policy: {
      minimumIterations: 10,
      minimumDurationMs: 10,
      maxHeapDriftBytes: 1000,
      maxPeakEventLoopLagMs: 10,
      maxPressureViolations: 0,
      warningHeapDriftRatio: 0.8,
      warningLagRatio: 0.8,
    },
  });

  assert.equal(profile.kind, "CUSTOM");
  assert.equal(profile.label, "Custom lab profile");
});

test("rejects custom baseline with empty label", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  assert.throws(
    () => factory.custom({
      label: " ",
      hardwareClass: "lab",
      recommendedUse: "Controlled soak certification.",
      policy: {
        minimumIterations: 10,
        minimumDurationMs: 10,
        maxHeapDriftBytes: 1000,
        maxPeakEventLoopLagMs: 10,
        maxPressureViolations: 0,
        warningHeapDriftRatio: 0.8,
        warningLagRatio: 0.8,
      },
    }),
    /label/,
  );
});

test("rejects custom baseline with invalid ratios", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  assert.throws(
    () => factory.custom({
      label: "Custom",
      hardwareClass: "lab",
      recommendedUse: "Controlled soak certification.",
      policy: {
        minimumIterations: 10,
        minimumDurationMs: 10,
        maxHeapDriftBytes: 1000,
        maxPeakEventLoopLagMs: 10,
        maxPressureViolations: 0,
        warningHeapDriftRatio: 1.2,
        warningLagRatio: 0.8,
      },
    }),
    /warningHeapDriftRatio/,
  );
});
