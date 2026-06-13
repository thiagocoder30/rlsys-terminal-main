import * as fs from 'fs';
import * as path from 'path';
import type { AnalyticsShadowTelemetry, TelemetrySink } from './AnalyticsShadowTelemetry.js';

export class BufferedFileTelemetrySink implements TelemetrySink {
  private readonly filePath: string;
  private buffer: string[] = [];
  private readonly maxBufferSize: number;
  private isFlushing = false;

  public constructor(filePath: string = '/sdcard/Download/rlsys/telemetry/shadow-audit.jsonl', maxBufferSize: number = 5) {
    this.filePath = filePath;
    this.maxBufferSize = maxBufferSize;
    this.ensureDirectoryExists();
  }

  public write(telemetry: AnalyticsShadowTelemetry): void {
    this.buffer.push(JSON.stringify(telemetry));
    if (this.buffer.length >= this.maxBufferSize && !this.isFlushing) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    this.isFlushing = true;
    
    const dataToFlush = this.buffer.join('\n') + '\n';
    this.buffer = [];
    
    fs.appendFile(this.filePath, dataToFlush, 'utf8', (error) => {
      this.isFlushing = false;
      if (error) {
        console.warn('[TELEMETRY SINK ERROR] Falha de I/O assíncrona:', error);
      } else if (this.buffer.length > 0) {
        // Auto-cura: Se acumulou dados durante o I/O, dispara novo flush imediatamente
        this.flush();
      }
    });
  }

  private ensureDirectoryExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (error) {}
  }
}
