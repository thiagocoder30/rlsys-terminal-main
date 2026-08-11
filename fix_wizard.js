const fs = require('fs');
let content = fs.readFileSync('src/application/session-startup/SessionStartupWizard.ts', 'utf8');

// Update setupEventListeners to listen for WARMUP_COMPLETED as well if it doesn't?
// Actually, it doesn't need to listen if executeSync/executeWarmup updates progress directly, which it does.
content = content.replace(
    "public async executeSync(operatorId: string = 'OP-CORE-001'): Promise<boolean> {",
    "public async executeSync(numbers: number[] = [], operatorId: string = 'OP-CORE-001'): Promise<boolean> {"
);
content = content.replace(
    "const result = await this.terminal.executeCommand('sync', operatorId);",
    "const result = await this.terminal.sync(numbers, operatorId);"
);
content = content.replace(
    "const result = await this.terminal.executeCommand('warmup', operatorId);",
    "const result = await this.terminal.warmup(operatorId);"
);

// We need to also fix ConfigurationEngine setProvider etc if they aren't fully updating HUD.
// The user says "StartupValidator bloqueando etapas".
// StartupValidator is already blocking. But let's check its output logic in OperatorController.

fs.writeFileSync('src/application/session-startup/SessionStartupWizard.ts', content);
