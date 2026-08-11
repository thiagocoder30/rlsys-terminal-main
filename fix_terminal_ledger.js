const fs = require('fs');
let content = fs.readFileSync('src/application/terminal/OperationalTerminal.ts', 'utf8');

content = content.replace(
    /'TERMINAL_COMMAND_EXECUTED',\n\s*\`Command 'sync' executed via import. Success: true. Execution time: \$\{executionTimeMs\}ms\`/g,
    `'SYNC_COMPLETED',
            \`Sync completed. \${numbers.length} giros reprocessados\``
);

content = content.replace(
    /'TERMINAL_COMMAND_EXECUTED',\n\s*\`Command 'warmup' executed directly. Success: true. Execution time: \$\{executionTimeMs\}ms\`/g,
    `'WARMUP_COMPLETED',
            \`Warmup completed. Pipeline calibrado\``
);

fs.writeFileSync('src/application/terminal/OperationalTerminal.ts', content);

let wizardContent = fs.readFileSync('src/application/session-startup/SessionStartupWizard.ts', 'utf8');
wizardContent = wizardContent.replace(
    /this\.ledger\.append\([\s\S]*?'STARTUP_COMPLETED',[\s\S]*?\);/g,
    `this.ledger.append(
            operatorId,
            '5.0.0',
            'STARTUP_READY',
            \`Session Startup completed successfully in \${executionTimeMs}ms for table \${this.selectedTable} with bankroll R$ \${this.configuredBankroll}.\`
        );`
);
fs.writeFileSync('src/application/session-startup/SessionStartupWizard.ts', wizardContent);

