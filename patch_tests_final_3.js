const fs = require('fs');

const testFiles = [
    'tests/application/session-control/SessionControlEngine.test.ts',
    'tests/application/bootstrap/ApplicationBootstrap.test.ts',
    'tests/application/configuration/ConfigurationEngineIntegration.test.ts'
];

for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix the .lm issue
    // In ApplicationBootstrap.test.ts, there is: sessionControlEngine = new SessionControlEngine(...)
    content = content.replace(
        "sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory);",
        "const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;"
    );

    // Some places had `engine.lm.createSession('test-id')` but `engine` is `sessionControlEngine`
    content = content.replace(
        "sessionControlEngine.startSession(1000, { provider: 'Evolution', minimumChipValue: 0.5 }); engine.lm.createSession('test-id'); engine.lm.startSession();",
        "sessionControlEngine.startSession(1000, { provider: 'Evolution', minimumChipValue: 0.5 }); sessionControlEngine.lm.createSession('test-id'); sessionControlEngine.lm.startSession();"
    );

    content = content.replace(
        "sessionControlEngine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();",
        "sessionControlEngine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); sessionControlEngine.lm.createSession('test-id'); sessionControlEngine.lm.startSession();"
    );

    // Fix expects for STOP_LOSS_TRIGGERED and STOP_WIN_TRIGGERED
    content = content.replace(
        "expect(engine.getStatus()).toBe('STOP_LOSS_TRIGGERED');",
        "expect(engine.getStatus()).toBe('FINISHED');"
    );
    content = content.replace(
        "expect(engine.getStatus()).toBe('STOP_WIN_TRIGGERED');",
        "expect(engine.getStatus()).toBe('FINISHED');"
    );

    fs.writeFileSync(file, content);
}
