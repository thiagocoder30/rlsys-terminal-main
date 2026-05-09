import fs from 'fs/promises';
import path from 'path';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  checks: Record<string, { status: 'ok' | 'degraded'; details?: string }>;
}

export class HealthCheckService {
  constructor(
    private readonly version: string,
    private readonly dataPath = './data'
  ) {}

  public async readiness(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {
      runtime: { status: 'ok', details: `node ${process.version}` },
      filesystem: await this.checkFilesystem()
    };

    const degraded = Object.values(checks).some(check => check.status !== 'ok');
    return {
      status: degraded ? 'degraded' : 'ok',
      service: 'rl-sys-core',
      version: this.version,
      timestamp: new Date().toISOString(),
      checks
    };
  }

  private async checkFilesystem(): Promise<{ status: 'ok' | 'degraded'; details?: string }> {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      const probe = path.join(this.dataPath, '.healthcheck');
      await fs.writeFile(probe, String(Date.now()), 'utf8');
      await fs.unlink(probe);
      return { status: 'ok', details: 'data directory is writable' };
    } catch (error) {
      return { status: 'degraded', details: error instanceof Error ? error.message : String(error) };
    }
  }
}
