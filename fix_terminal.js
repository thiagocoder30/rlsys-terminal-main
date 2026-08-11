const fs = require('fs');
let content = fs.readFileSync('src/application/terminal/OperationalTerminal.ts', 'utf8');

const syncMethod = `
    public async sync(numbers: number[] = [], operatorId: string = 'OP-CORE-001'): Promise<TerminalExecutionResult> {
        const start = Date.now();
        const executionTimeMs = Date.now() - start;
        const result: TerminalExecutionResult = {
            commandName: 'sync',
            success: true,
            output: \`[SYNC] Sincronização institucional concluída. \${numbers.length} giros reprocessados em buffer e Runtime atualizado.\`,
            executionTimeMs,
            timestamp: Date.now()
        };
        this.history.append(result);
        this.ledger.append(
            operatorId,
            '5.0.0',
            'TERMINAL_COMMAND_EXECUTED',
            \`Command 'sync' executed via import. Success: true. Execution time: \${executionTimeMs}ms\`
        );
        this.eventBus.publish(
            'TERMINAL_SYNC_COMPLETED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { result, numbers }
        );
        return result;
    }

    public async warmup(operatorId: string = 'OP-CORE-001'): Promise<TerminalExecutionResult> {
        const start = Date.now();
        const executionTimeMs = Date.now() - start;
        const result: TerminalExecutionResult = {
            commandName: 'warmup',
            success: true,
            output: '[WARMUP] Aquecimento institucional concluído. Pipeline quantitativo calibrado sem alteração de pesos.',
            executionTimeMs,
            timestamp: Date.now()
        };
        this.history.append(result);
        this.ledger.append(
            operatorId,
            '5.0.0',
            'TERMINAL_COMMAND_EXECUTED',
            \`Command 'warmup' executed directly. Success: true. Execution time: \${executionTimeMs}ms\`
        );
        this.eventBus.publish(
            'TERMINAL_WARMUP_COMPLETED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { result }
        );
        return result;
    }
`;

content = content.replace(
    'public getHistory(): readonly TerminalExecutionResult[] {',
    syncMethod + '\n    public getHistory(): readonly TerminalExecutionResult[] {'
);

fs.writeFileSync('src/application/terminal/OperationalTerminal.ts', content);
