const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeV1Certification,
} = require("../dist/application/runtime/PaperRuntimeV1Certification.js");

test("certifies complete paper runtime v1 surface", () => {
  const result = new PaperRuntimeV1Certification().certify({
    hasInteractiveLoop: true,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion: true,
  });

  assert.equal(result.status, "CERTIFIED");
  assert.equal(result.certified, true);
  assert.equal(result.score, 100);
});

test("fails incomplete paper runtime v1 surface", () => {
  const result = new PaperRuntimeV1Certification().certify({
    hasInteractiveLoop: false,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion: true,
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /Interactive loop/);
});
