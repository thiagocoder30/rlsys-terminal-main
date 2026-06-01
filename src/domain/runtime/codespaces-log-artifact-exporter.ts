import * as fs from 'fs';
import * as path from 'path';

export type CodespacesLogExportStatus = 'SUCCESS' | 'FAILURE';

export interface CodespacesLogArtifactInput {
  readonly sprintId: number;
  readonly sprintName: string;
  readonly status: CodespacesLogExportStatus;
  readonly rootDir: string;
  readonly timestamp: string;
  readonly mainLogPath: string;
  readonly exitCode: number;
}

export interface CodespacesLogArtifactManifest {
  readonly project: 'RL.SYS CORE';
  readonly sprintId: number;
  readonly sprintName: string;
  readonly status: CodespacesLogExportStatus;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly mainLogPath: string;
  readonly successLogPath: string;
  readonly failureLogPath: string;
  readonly exportFilePath: string;
  readonly exitCode: number;
  readonly directories: {
    readonly logs: string;
    readonly artifactLogs: string;
    readonly exports: string;
  };
}

export interface CodespacesLogArtifactResult {
  readonly ok: boolean;
  readonly manifest?: CodespacesLogArtifactManifest;
  readonly error?: string;
}

export class CodespacesLogArtifactExporter {
  public createManifest(input: CodespacesLogArtifactInput): CodespacesLogArtifactResult {
    try {
      const safeSprintId = this.assertPositiveInteger(input.sprintId, 'sprintId');
      const safeTimestamp = this.assertSafeToken(input.timestamp, 'timestamp');
      const safeSprintName = this.assertSafeName(input.sprintName, 'sprintName');

      const rootDir = path.resolve(input.rootDir);
      const artifactLogsDir = path.join(rootDir, 'artifacts', 'logs');
      const exportDir = path.join(rootDir, 'artifacts', 'export');

      fs.mkdirSync(path.join(rootDir, 'logs'), { recursive: true });
      fs.mkdirSync(artifactLogsDir, { recursive: true });
      fs.mkdirSync(exportDir, { recursive: true });

      const successLogPath = path.join(artifactLogsDir, `sprint-${safeSprintId}-${safeTimestamp}-success.log`);
      const failureLogPath = path.join(artifactLogsDir, `sprint-${safeSprintId}-${safeTimestamp}-failure.log`);
      const exportFilePath = path.join(exportDir, `rlsys-sprint-${safeSprintId}-${safeTimestamp}-codespaces-logs.tar.gz`);

      const manifest: CodespacesLogArtifactManifest = {
        project: 'RL.SYS CORE',
        sprintId: safeSprintId,
        sprintName: safeSprintName,
        status: input.status,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        generatedAt: new Date().toISOString(),
        rootDir,
        mainLogPath: path.resolve(input.mainLogPath),
        successLogPath,
        failureLogPath,
        exportFilePath,
        exitCode: input.exitCode,
        directories: {
          logs: 'logs/',
          artifactLogs: 'artifacts/logs/',
          exports: 'artifacts/export/',
        },
      };

      fs.writeFileSync(
        input.status === 'SUCCESS' ? successLogPath : failureLogPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );

      return { ok: true, manifest };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown exporter error',
      };
    }
  }

  private assertPositiveInteger(value: number, fieldName: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private assertSafeToken(value: string, fieldName: string): string {
    if (!/^[0-9A-Za-z._-]+$/.test(value)) {
      throw new Error(`${fieldName} contains unsafe characters`);
    }
    return value;
  }

  private assertSafeName(value: string, fieldName: string): string {
    if (!/^[0-9A-Za-z ._-]+$/.test(value)) {
      throw new Error(`${fieldName} contains unsafe characters`);
    }
    return value;
  }
}
