import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeFaultIsolationBoundary } from "../dist/application/runtime/RuntimeFaultIsolationBoundary.js";

test("executes successful critical operation", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  const result = await boundary.execute(
    "risk-gateway",
    { zone: "CRITICAL", maxFailuresBeforeOpen: 1, recoverable: false },
    async () => "allowed",
  );

  assert.equal(result.status, "EXECUTED");
  assert.equal(result.value, "allowed");
  assert.equal(result.failureCount, 0);
});

test("throws on critical zone failure", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "risk-gateway",
      { zone: "CRITICAL", maxFailuresBeforeOpen: 1, recoverable: false },
      async () => {
        throw new Error("risk failure");
      },
    ),
    /Critical runtime zone failed/,
  );

  assert.equal(boundary.getFailureCount("risk-gateway"), 1);
  assert.equal(boundary.isCircuitOpen("risk-gateway"), true);
});

test("degrades non critical zone failure without throwing", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  const result = await boundary.execute(
    "telemetry",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => {
      throw new Error("telemetry unavailable");
    },
  );

  assert.equal(result.status, "DEGRADED");
  assert.equal(result.zone, "NON_CRITICAL");
  assert.equal(result.failureCount, 1);
  assert.match(result.errorMessage, /telemetry unavailable/);
});

test("opens circuit after repeated recoverable failures", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  for (let index = 0; index < 2; index += 1) {
    await boundary.execute(
      "reporter",
      { zone: "IMPORTANT", maxFailuresBeforeOpen: 2, recoverable: true },
      async () => {
        throw new Error("disk unavailable");
      },
    );
  }

  const result = await boundary.execute(
    "reporter",
    { zone: "IMPORTANT", maxFailuresBeforeOpen: 2, recoverable: true },
    async () => "should not run",
  );

  assert.equal(result.status, "CIRCUIT_OPEN");
  assert.equal(result.failureCount, 2);
  assert.equal(boundary.isCircuitOpen("reporter"), true);
});

test("successful execution resets failure count", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await boundary.execute(
    "hud",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => {
      throw new Error("render failure");
    },
  );

  const result = await boundary.execute(
    "hud",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => "hud rendered",
  );

  assert.equal(result.status, "EXECUTED");
  assert.equal(result.failureCount, 0);
  assert.equal(boundary.getFailureCount("hud"), 0);
});

test("reset closes circuit and clears failure count", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await boundary.execute(
    "audit",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 1, recoverable: true },
    async () => {
      throw new Error("audit failure");
    },
  );

  assert.equal(boundary.isCircuitOpen("audit"), true);

  boundary.reset("audit");

  assert.equal(boundary.isCircuitOpen("audit"), false);
  assert.equal(boundary.getFailureCount("audit"), 0);
});

test("rejects invalid zone id", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "   ",
      { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 1, recoverable: true },
      async () => "ok",
    ),
    /zoneId/,
  );
});

test("rejects invalid max failures policy", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "telemetry",
      { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 0, recoverable: true },
      async () => "ok",
    ),
    /maxFailuresBeforeOpen/,
  );
});
