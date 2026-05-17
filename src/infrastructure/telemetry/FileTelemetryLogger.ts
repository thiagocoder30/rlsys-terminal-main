import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionTelemetryLogger, SpinTelemetryData } from '../../application/telemetry/TelemetryContracts';

export class FileTelemetryLogger implements SessionTelemetryLogger {
  private readonly filePath: string;
  private readonly isInitialized: boolean = false;

  constructor(storageDirectory: string) {
    if (!fs.existsSync(storageDirectory)) {
      fs.mkdirSync(storageDirectory, { recursive: true });
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    this.filePath = path.join(storageDirectory, `session_telemetry_${dateStr}.csv`);

    // Injetar cabeçalho CSV se o ficheiro for novo
    if (!fs.existsSync(this.filePath)) {
      try {
        const header = "timestampMs,dealerId,wheelSpeed,targetSector,action,expectedEV,confidence,recommendedUnits,pnl,latencyMs\n";
        fs.writeFileSync(this.filePath, header, 'utf-8');
        this.isInitialized = true;
      } catch (e) {
        console.error("[TELEMETRIA] Falha ao criar cabeçalho do log.", e);
      }
    } else {
      this.isInitialized = true;
    }
  }

  /**
   * Gravação Fire-and-Forget (Assíncrona).
   * O(1) na main thread, não trava o Event Loop do Node.js.
   */
  public logSpin(data: SpinTelemetryData): void {
    if (!this.isInitialized) return;

    const row = `${data.timestampMs},${data.dealerId},${data.wheelSpeed},${data.targetSector},${data.action},${data.expectedEV.toFixed(4)},${data.confidence.toFixed(4)},${data.recommendedUnits},${data.pnl},${data.latencyMs.toFixed(2)}\n`;

    // Fail-Safe: Se o disco falhar, o callback captura o erro sem derrubar o sistema.
    fs.appendFile(this.filePath, row, 'utf-8', (err) => {
      if (err) {
        console.error("\n[AVISO DE SISTEMA] Falha não-fatal ao gravar telemetria no disco.");
      }
    });
  }
}
