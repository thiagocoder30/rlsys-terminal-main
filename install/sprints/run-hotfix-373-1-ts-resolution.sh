#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - HOTFIX 373.1"
echo " TS7016: TYPE DECLARATION RESOLUTION"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/3] Expurgando JS legado e convertendo o Cofre para TypeScript Nativo..."
rm -f src/infrastructure/persistence/SecureBankrollRepository.js

cat > src/infrastructure/persistence/SecureBankrollRepository.ts <<'EOF'
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';

export class SecureBankrollRepository implements IBankrollRepository {
    private readonly dataDir: string;
    private readonly filePath: string;
    private readonly keyPath: string;
    private readonly secretKey: string;

    constructor() {
        this.dataDir = path.join(__dirname, '..', '..', '..', 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.filePath = path.join(this.dataDir, 'bankroll-state.json');
        this.keyPath = path.join(this.dataDir, '.sys_lock_key');
        
        this.secretKey = this._getOrCreateKey();
    }

    private _getOrCreateKey(): string {
        if (fs.existsSync(this.keyPath)) {
            return fs.readFileSync(this.keyPath, 'utf8');
        }
        const newKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(this.keyPath, newKey, { encoding: 'utf8', mode: 0o600 });
        return newKey;
    }

    private _generateSignature(payload: any): string {
        return crypto.createHmac('sha256', this.secretKey)
                     .update(JSON.stringify(payload))
                     .digest('hex');
    }

    public load(): any | null {
        if (!fs.existsSync(this.filePath)) return null;

        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(fileContent);

            if (!parsed.signature || !parsed.payload) {
                console.error('\n\x1b[41m\x1b[37m [!] ALERTA CRÍTICO DE INTEGRIDADE \x1b[0m');
                console.error('\x1b[31m O formato do arquivo de dados não está assinado digitalmente.\x1b[0m');
                console.error('\x1b[31m Ação: Sistema forçado em modo Hard Lock por segurança.\x1b[0m\n');
                return { isDailyHardLocked: true, hardLockDateEpoch: Date.now() };
            }

            const expectedSignature = this._generateSignature(parsed.payload);
            if (expectedSignature !== parsed.signature) {
                console.error('\n\x1b[41m\x1b[37m [!] ALERTA DE VIOLAÇÃO (ANTI-TAMPER) \x1b[0m');
                console.error('\x1b[31m O arquivo de estado foi editado manualmente. Assinatura inválida.\x1b[0m');
                console.error('\x1b[31m Ação: Tentativa de bypass detectada. Sistema trancado em quarentena.\x1b[0m\n');
                return { isDailyHardLocked: true, hardLockDateEpoch: Date.now() };
            }

            return parsed.payload;
        } catch (error) {
            console.error('\x1b[31m[Erro de I/O] Falha ao acessar o cofre de dados.\x1b[0m');
            return null;
        }
    }

    public save(state: any): void {
        const signature = this._generateSignature(state);
        const secureEnvelope = {
            payload: state,
            signature: signature
        };
        fs.writeFileSync(this.filePath, JSON.stringify(secureEnvelope, null, 2), 'utf8');
    }
}
EOF

echo "[2/3] Corrigindo extensões de importação no Composition Root..."
cat > src/main.ts <<'EOF'
import { SecureBankrollRepository } from './infrastructure/persistence/SecureBankrollRepository';
import { LiveMesaTracker } from './domain/analytics/LiveMesaTracker';
import { LivePaperOrchestrator } from './presentation/cli/LivePaperOrchestrator';

// 1. Instanciação das dependências (Infra & Analítica)
const bankrollRepository = new SecureBankrollRepository();
const mesaTracker = new LiveMesaTracker();

// 2. Injeção de Dependências no Orquestrador
const orchestrator = new LivePaperOrchestrator(
    bankrollRepository,
    mesaTracker
);

// 3. Ignita o sistema
orchestrator.initialize().catch(err => {
    console.error('Falha crítica na ignição do sistema:', err);
    process.exit(1);
});
EOF

echo "[3/3] Registrando commit de Hotfix na árvore..."
git add src/infrastructure/persistence/ src/main.ts
git commit -m "fix(architecture): migrate SecureBankrollRepository to TS and fix TS7016 module resolution in main entrypoint (Hotfix 373.1)" > /dev/null

echo "======================================"
echo -e "\033[1;32m HOTFIX 373.1 APLICADO COM SUCESSO \033[0m"
echo " STATUS: TIPAGEM ESTRITA RESTAURADA"
echo "======================================"

