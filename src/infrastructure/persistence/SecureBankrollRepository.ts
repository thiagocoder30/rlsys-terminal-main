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
