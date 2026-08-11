const fs = require('fs');

const file = 'tests/application/session-startup/SessionStartupWizard.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));",
    "const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;"
);

content = content.replace(
    "wizard = new SessionStartupWizard(\n            progress,\n            history,\n            sessionControlEngine,\n            terminal,\n            eventBus,\n            ledger,\n            configEngine\n        );",
    "wizard = new SessionStartupWizard(\n            progress,\n            history,\n            sessionControlEngine,\n            terminal,\n            eventBus,\n            ledger,\n            configEngine,\n            lm\n        );"
);
fs.writeFileSync(file, content);
