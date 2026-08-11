const fs = require('fs');

const testFiles = [
    'tests/application/session-control/SessionControlEngine.test.ts',
    'tests/application/session-control/SessionReportService.test.ts',
    'tests/application/configuration/ConfigurationEngineIntegration.test.ts',
    'tests/application/bootstrap/ApplicationBootstrap.test.ts',
    'tests/application/bootstrap/BootstrapReportService.test.ts',
];

for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf8');

    // For ApplicationBootstrap.test.ts and BootstrapReportService.test.ts:
    // we need to insert lifecycleManager into ApplicationBootstrap instantiation
    content = content.replace(
        "bootstrap = new ApplicationBootstrap(\n            configEngine,\n            sessionControlEngine,\n            wizard,\n            eventBus,\n            ledger",
        "bootstrap = new ApplicationBootstrap(\n            configEngine,\n            sessionControlEngine,\n            wizard,\n            new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger),\n            eventBus,\n            ledger"
    );

    // For SessionControlEngine tests, we need to extract lifecycleManager so we can call startSession on it.
    // Replace the inline instantiation with a variable.
    content = content.replace(
        "engine = new SessionControlEngine(eventBus, ledger, history, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));",
        "const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); engine = new SessionControlEngine(eventBus, ledger, history, lm); engine.lm = lm;"
    );

    content = content.replace(
        "const engine = new SessionControlEngine(eventBus, ledger, history, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));",
        "const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const engine = new SessionControlEngine(eventBus, ledger, history, lm); engine.lm = lm;"
    );

    content = content.replace(
        "const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));",
        "const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;"
    );

    // Now, anywhere `startSession(1000` is called, we can append `.lm.createSession('id'); .lm.startSession();`
    content = content.replace(
        /engine\.startSession\(1000, \{ provider: 'Pragmatic', minimumChipValue: 0\.1 \}\);/g,
        "engine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();"
    );

    content = content.replace(
        /engine\.startSession\(1000, \{ provider: 'Evolution', minimumChipValue: 0\.5 \}\);/g,
        "engine.startSession(1000, { provider: 'Evolution', minimumChipValue: 0.5 }); engine.lm.createSession('test-id'); engine.lm.startSession();"
    );

    content = content.replace(
        /sessionControlEngine\.startSession\((.*?), (.*?)\);/g,
        "sessionControlEngine.startSession($1, $2); sessionControlEngine.lm.createSession('test-id'); sessionControlEngine.lm.startSession();"
    );

    fs.writeFileSync(file, content);
}

// We need to add `lm: any` to SessionControlEngine as a public prop to avoid ts errors in tests, or we cast it to any.
let engineFile = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');
if (!engineFile.includes("public lm?: any;")) {
    engineFile = engineFile.replace(
        "private losses = 0;",
        "private losses = 0;\n    public lm?: any;"
    );
    fs.writeFileSync('src/application/session-control/SessionControlEngine.ts', engineFile);
}
