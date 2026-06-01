const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { CodespacesLogArtifactExporter } = require('../dist/domain/runtime/codespaces-log-artifact-exporter');

test('CodespacesLogArtifactExporter creates success manifest without live money', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-success-'));
  const exporter = new CodespacesLogArtifactExporter();

  const result = exporter.createManifest({
    sprintId: 177,
    sprintName: 'Codespaces Log Artifact Exporter',
    status: 'SUCCESS',
    rootDir,
    timestamp: '20260601-120000',
    mainLogPath: path.join(rootDir, 'logs', 'main.log'),
    exitCode: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.productionMoneyAllowed, false);
  assert.equal(result.manifest.liveMoneyAuthorization, false);
  assert.ok(fs.existsSync(result.manifest.successLogPath));
});

test('CodespacesLogArtifactExporter creates failure manifest with exit code', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-failure-'));
  const exporter = new CodespacesLogArtifactExporter();

  const result = exporter.createManifest({
    sprintId: 177,
    sprintName: 'Codespaces Log Artifact Exporter',
    status: 'FAILURE',
    rootDir,
    timestamp: '20260601-120001',
    mainLogPath: path.join(rootDir, 'logs', 'main.log'),
    exitCode: 2,
  });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.status, 'FAILURE');
  assert.equal(result.manifest.exitCode, 2);
  assert.ok(fs.existsSync(result.manifest.failureLogPath));
});

test('CodespacesLogArtifactExporter rejects unsafe timestamp', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-invalid-'));
  const exporter = new CodespacesLogArtifactExporter();

  const result = exporter.createManifest({
    sprintId: 177,
    sprintName: 'Codespaces Log Artifact Exporter',
    status: 'SUCCESS',
    rootDir,
    timestamp: '../unsafe',
    mainLogPath: path.join(rootDir, 'logs', 'main.log'),
    exitCode: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /timestamp contains unsafe characters/);
});
