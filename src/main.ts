import * as readline from 'readline';
import { AppContainer } from './infrastructure/di/AppContainer';
import { PythonOcrAdapter } from './infrastructure/ocr/PythonOcrAdapter';

// 1. Inicialização do Ecossistema (DDD) via Static Bootstrap
const bootResult = AppContainer.bootstrap({
  storageDirectory: './data', // Ajuste caso a sua pasta de ficheiros seja diferente
  targetSnapshotId: 'latest', 
  bootTimeMs: Date.now()
});

const coordinator = bootResult.coordinator;
const ocrAdapter = new PythonOcrAdapter();

// 2. Configuração do CLI Interativo
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n=========================================");
console.log(" 🎯 RLSYS SATELLITE - MOTOR TÁTICO CLI");
console.log("=========================================");
console.log(" - Digite um número (0-36) para girar a roleta.");
console.log(" - Digite 'ocr' para capturar histórico na nuvem.");
console.log(" - Digite 'sair' para encerrar.");
console.log("=========================================\n");

const askForInput = () => {
    rl.question("\x1b[33mAguardando comando/número: \x1b[0m", async (input) => {
        const command = input.trim().toLowerCase();

        if (command === 'sair' || command === 'exit') {
            console.log("\n[MAIN] Suspendendo Motor Tático. Até logo!");
            rl.close();
            process.exit(0);
        }

        if (command === 'ocr') {
            const historico = await ocrAdapter.extractHistory();
            
            if (historico.length > 0) {
                console.log(`\n[MAIN] Iniciando Ingestão de Cold Start (${historico.length} rodadas)...`);
                
                const historicoCronologico = [...historico].reverse(); 

                for (const num of historicoCronologico) {
                    try {
                        await coordinator.registerOutcome(num);
                        await coordinator.processLiveSpin(num);
                    } catch (err) {
                        console.error(`[MAIN Erro] Falha ao injetar rodada ${num}:`, err);
                    }
                }
                
                console.log(`\x1b[32m[MAIN] Cold Start Concluído! Motor Matemático abastecido com ${historico.length} eventos.\x1b[0m\n`);
            }
            askForInput();
            return;
        }

        const num = parseInt(command, 10);
        if (!isNaN(num) && num >= 0 && num <= 36) {
            try {
                await coordinator.registerOutcome(num);
                const decisao = await coordinator.processLiveSpin(num);
                
                console.log(`\n\x1b[36m--- DECISÃO DE EDGE ---\x1b[0m`);
                console.dir(decisao, { depth: null, colors: true });
                console.log(`\x1b[36m-----------------------\x1b[0m\n`);
                
            } catch (err) {
                console.error(`\x1b[31m[MAIN Erro]\x1b[0m Falha ao processar rodada manual:`, err);
            }
        } else {
            console.log("\x1b[31m[!] Entrada inválida. Digite 0-36 ou 'ocr'.\x1b[0m\n");
        }

        askForInput();
    });
};

askForInput();
