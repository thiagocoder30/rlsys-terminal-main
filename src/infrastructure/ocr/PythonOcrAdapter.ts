import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PythonOcrAdapter {
    /**
     * Acorda o ambiente virtual Python, executa o Gemini Vision,
     * captura o stdout, extrai a matriz JSON e mata o processo.
     */
    public async extractHistory(): Promise<number[]> {
        console.log("\x1b[36m[OCR Adapter]\x1b[0m Invocando satélite Python/Gemini. Aguarde...");
        try {
            // Executa o Python garantindo que o ambiente virtual (venv) está ativado
            const { stdout, stderr } = await execAsync('source venv/bin/activate && python extrator_gemini.py', { shell: '/bin/bash' });

            // Regex multi-linha para extrair rigorosamente o conteúdo do JSON
            const match = stdout.match(/===JSON_START===\n([\s\S]*?)\n===JSON_END===/m);
            
            if (match && match[1]) {
                const numbers: number[] = JSON.parse(match[1]);
                console.log(`\x1b[32m[OCR Adapter]\x1b[0m Ponte estabelecida! ${numbers.length} números importados da nuvem.`);
                return numbers;
            } else {
                console.error("\x1b[31m[OCR Adapter Erro]\x1b[0m Assinatura JSON não encontrada no payload do Python.");
                console.debug("Saída bruta:\n", stdout);
                return [];
            }
        } catch (error) {
            console.error("\x1b[31m[OCR Adapter Erro Crítico]\x1b[0m Falha ao executar o processo filho.", error);
            return [];
        }
    }
}
