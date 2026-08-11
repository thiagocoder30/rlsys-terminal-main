const fs = require('fs');
let content = fs.readFileSync('src/application/session-startup/SessionStartupWizard.ts', 'utf8');

content = content.replace(
    /private setupEventListeners\(\): void \{[\s\S]*?public startFlow/g,
    `private setupEventListeners(): void {
        this.eventBus.subscribe('TERMINAL_SYNC_COMPLETED', () => {
            if (this.currentState === 'SYNCING_HISTORY') {
                this.progress.markCompleted('HistorySync');
                this.emitStepCompleted('HistorySync');
            }
        });
        this.eventBus.subscribe('TERMINAL_WARMUP_COMPLETED', () => {
            if (this.currentState === 'RUNNING_WARMUP') {
                this.progress.markCompleted('Warmup');
                this.emitStepCompleted('Warmup');
            }
        });
        this.eventBus.subscribe('CONFIGURATION_UPDATED', () => {
            // Can sync internal status if needed
        });
        this.eventBus.subscribe('STARTUP_VALIDATED', () => {
            // Can sync internal status if needed
        });
        this.eventBus.subscribe('SESSION_STARTED', () => {
            // Can sync internal status if needed
        });
    }

    public startFlow`
);

content = content.replace(
    /this\.eventBus\.publish\(\n\s*'STARTUP_FINISHED',/g,
    `this.eventBus.publish(
            'STARTUP_VALIDATED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { validation }
        );
        this.eventBus.publish(
            'STARTUP_READY',
            '5.0.0',
            randomUUID(),
            operatorId,
            { tableProvider: this.selectedTable, bankroll: this.configuredBankroll }
        );
        this.eventBus.publish(
            'STARTUP_FINISHED',`
);

fs.writeFileSync('src/application/session-startup/SessionStartupWizard.ts', content);
