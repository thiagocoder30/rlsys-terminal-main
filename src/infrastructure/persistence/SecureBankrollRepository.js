'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class SecureBankrollRepository {
    constructor() {
        this.dataDir = path.join(__dirname, '..', '..', '..', 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.filePath = path.join(this.dataDir, 'bankroll-state.json');
        this.keyPath = path.join(this.dataDir, '.sys_lock_key');
        
        // Inicializa ou recupera a chave criptográfica do sistema
        this.secretKey = this._getOrCreateKey();
    }

    _getOrCreateKey() {
        if (fs.existsSync(this.keyPath)) {
            return fs.readFileSync(this.keyPath, 'utf8');
        }
        // Gera um entropy alto para a chave secreta e restringe a leitura do arquivo
        const newKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(this.keyPath, newKey, { encoding: 'utf8', mode: 0o600 });
        return newKey;
    }

    _generateSignature(payload) {
        return crypto.createHmac('sha256', this.secretKey)
                     .update(JSON.stringify(payload))
                     .digest('hex');
    }

    load() {
        if (!fs.existsSync(this.filePath)) return null;

        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(fileContent);

            // Defesa 1: Checa se o arquivo é legado (sem criptografia)
            if (!parsed.signature || !parsed.payload) {
                console.error('\n\x1b[41m\x1b[37m [!] ALERTA CRÍTICO DE INTEGRIDADE \x1b[0m');
                console.error('\x1b[31m O formato do arquivo de dados não está assinado digitalmente.\x1b[0m');
                console.error('\x1b[31m Ação: Sistema forçado em modo Hard Lock por segurança.\x1b[0m\n');
                return { isDailyHardLocked: true, hardLockDateEpoch: Date.now() };
            }

            // Defesa 2: Valida a assinatura HMAC
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

    save(state) {
        const signature = this._generateSignature(state);
        const secureEnvelope = {
            payload: state,
            signature: signature
        };
        fs.writeFileSync(this.filePath, JSON.stringify(secureEnvelope, null, 2), 'utf8');
    }
}

module.exports = { SecureBankrollRepository };
