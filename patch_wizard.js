const fs = require('fs');
let content = fs.readFileSync('src/application/session-startup/SessionStartupWizard.ts', 'utf8');

content = content.replace(
    /        if \(result\.success\) \{\n            this\.progress\.markCompleted\('HistorySync'\);\n            this\.emitStepCompleted\('HistorySync', \{ output: result\.output \}\);\n            this\.currentState = 'RUNNING_WARMUP';\n            return true;\n        \} else \{\n            this\.fail\('Falha durante a sincronização de histórico\.', operatorId\);\n            return false;\n        \}/,
    `        if (result.success) {
            this.progress.markCompleted('HistorySync');
            this.emitStepCompleted('HistorySync', { output: result.output });
            this.currentState = 'RUNNING_WARMUP';
            return true;
        } else {
            // Do not fail the whole wizard, just don't advance
            return false;
        }`
);

content = content.replace(
    /        if \(result\.success\) \{\n            this\.progress\.markCompleted\('Warmup'\);\n            this\.emitStepCompleted\('Warmup', \{ output: result\.output \}\);\n            this\.currentState = 'VALIDATING';\n            return true;\n        \} else \{\n            this\.fail\('Falha durante o aquecimento institucional \\(Warmup\\)\.', operatorId\);\n            return false;\n        \}/,
    `        if (result.success) {
            this.progress.markCompleted('Warmup');
            this.emitStepCompleted('Warmup', { output: result.output });
            this.currentState = 'VALIDATING';
            return true;
        } else {
            return false;
        }`
);

fs.writeFileSync('src/application/session-startup/SessionStartupWizard.ts', content);
