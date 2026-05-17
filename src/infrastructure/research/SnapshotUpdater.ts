import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as path from 'node:path';
import { SelfLearningEngine } from '../../domain/research/SelfLearningEngine';

export class SnapshotUpdater {
  constructor(private readonly storageDirectory: string) {}

  public async runRefinementCycle(): Promise<void> {
    console.log("[CIENTISTA] Iniciando ingestão de telemetria (Stream Mode)...");
    const engine = new SelfLearningEngine();
    const telemetryFiles = fs.readdirSync(this.storageDirectory).filter(f => f.startsWith('session_telemetry_') && f.endsWith('.csv'));

    if (telemetryFiles.length === 0) {
      console.log("[CIENTISTA] Nenhum log de telemetria encontrado.");
      return;
    }

    // Leitura Assíncrona O(1) de Memória
    for (const file of telemetryFiles) {
      const filePath = path.join(this.storageDirectory, file);
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let isHeader = true;
      for await (const line of rl) {
        if (isHeader) { isHeader = false; continue; }
        
        // CSV: timestampMs,dealerId,wheelSpeed,targetSector,action,expectedEV,confidence,recommendedUnits,pnl,latencyMs
        const parts = line.split(',');
        if (parts.length >= 9) {
          const dealerId = parts[1];
          const speed = parts[2];
          const sector = parseInt(parts[3], 10);
          const action = parts[4];
          const pnl = parseFloat(parts[8]);
          engine.ingestTelemetry(dealerId, speed, sector, action, pnl);
        }
      }
    }

    console.log("[CIENTISTA] Processamento de ficheiros concluído. Refinando cérebro...");

    // Atualização Segura (Fail-Safe)
    const snapshotPath = path.join(this.storageDirectory, 'default_alpha.json');
    if (!fs.existsSync(snapshotPath)) throw new Error("Snapshot base não encontrado.");
    
    const existingData = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const refinedData = engine.refineSnapshot(existingData);

    fs.writeFileSync(snapshotPath, JSON.stringify(refinedData, null, 2));
    console.log("[CIENTISTA] Snapshot default_alpha.json atualizado com sucesso. Novo EV e Confiança registados.");
  }
}
