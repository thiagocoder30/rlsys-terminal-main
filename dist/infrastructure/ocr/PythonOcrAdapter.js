"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonOcrAdapter = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class PythonOcrAdapter {
    /**
     * Acorda o ambiente virtual Python, executa o Gemini Vision,
     * captura o stdout, extrai a matriz JSON e mata o processo.
     */
    async extractHistory() {
        console.log("\x1b[36m[OCR Adapter]\x1b[0m Invocando satélite Python/Gemini. Aguarde...");
        try {
            // Executa o Python garantindo que o ambiente virtual (venv) está ativado
            const { stdout, stderr } = await execAsync('source venv/bin/activate && python extrator_gemini.py', { shell: '/bin/bash' });
            // Regex multi-linha para extrair rigorosamente o conteúdo do JSON
            const match = stdout.match(/===JSON_START===\n([\s\S]*?)\n===JSON_END===/m);
            if (match && match[1]) {
                const numbers = JSON.parse(match[1]);
                console.log(`\x1b[32m[OCR Adapter]\x1b[0m Ponte estabelecida! ${numbers.length} números importados da nuvem.`);
                return numbers;
            }
            else {
                console.error("\x1b[31m[OCR Adapter Erro]\x1b[0m Assinatura JSON não encontrada no payload do Python.");
                console.debug("Saída bruta:\n", stdout);
                return [];
            }
        }
        catch (error) {
            console.error("\x1b[31m[OCR Adapter Erro Crítico]\x1b[0m Falha ao executar o processo filho.", error);
            return [];
        }
    }
}
exports.PythonOcrAdapter = PythonOcrAdapter;
