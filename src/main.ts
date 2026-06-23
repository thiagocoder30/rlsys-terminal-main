import { LivePaperOrchestrator } from './presentation/cli/LivePaperOrchestrator';
import { IBankrollRepository } from './domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from './domain/interfaces/IAnalyticsEngine';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 1. Adaptador de Persistência (Garante que a banca é salva em disco)
class FileBankrollRepository implements IBankrollRepository {
    private filePath = path.join(process.cwd(), 'data', 'bankroll-state.json');
    load() {
        if (fs.existsSync(this.filePath)) {
            return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        }
        return null;
    }
    save(state: any) {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
    }
}

// 2. Adaptador de Analytics (O motor que processa a fita)
class LocalMesaTracker implements IAnalyticsEngine {
    private history: number[] = [];
    addNumber(n: number): void { this.history.push(n); }
    getHistory(): number[] { return this.history; }
    getFrequencies(): Map<number, number> {
        const freq = new Map<number, number>();
        this.history.forEach(n => freq.set(n, (freq.get(n) || 0) + 1));
        return freq;
    }
    getDistributionStats(): any {
        const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        let red=0, black=0, zero=0, even=0, odd=0, low=0, high=0;
        this.history.forEach(n => {
            if (n === 0) zero++;
            else {
                if (REDS.has(n)) red++; else black++;
                if (n % 2 === 0) even++; else odd++;
                if (n <= 18) low++; else high++;
            }
        });
        return { total: this.history.length, red, black, zero, even, odd, low, high };
    }
    getTimeline(n: number): string { return this.history.slice(-n).join(', '); }
}

// 3. O Ponto de Ignição Oficial
async function bootstrap() {
    console.clear();
    console.log('======================================');
    console.log('🚀 BOOTING RL.SYS INSTITUTIONAL CORE...');
    console.log('======================================');
    
    // Injeção de Dependências
    const bankrollRepo = new FileBankrollRepository();
    const mesaTracker = new LocalMesaTracker();
    
    // Passar o controlo da aplicação para o nosso Orquestrador
    const orchestrator = new LivePaperOrchestrator(bankrollRepo, mesaTracker);
    await orchestrator.initialize();
}

bootstrap().catch(err => {
    console.error('[FATAL BOOT ERROR]', err);
    process.exit(1);
});
