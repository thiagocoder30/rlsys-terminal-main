const fs = require('fs');

const files = [
    'tests/application/session-startup/SessionStartupReportService.test.ts',
    'tests/application/session-control/SessionReportService.test.ts'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(
        "new SessionControlEngine(eventBus, ledger, new SessionHistory(, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger)))",
        "new SessionControlEngine(eventBus, ledger, new SessionHistory(), new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger))"
    );

    // Some might have been transformed to something else depending on the exact string
    // Let's just do it with regex to fix the parenthesis
    content = content.replace(/new SessionHistory\(\,/g, "new SessionHistory(),");
    content = content.replace(/history\,/g, "history,");

    fs.writeFileSync(file, content);
}
