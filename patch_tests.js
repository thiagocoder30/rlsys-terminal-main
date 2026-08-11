const fs = require('fs');

const testFiles = [
    'tests/application/session-control/SessionControlEngine.test.ts',
    'tests/application/session-control/SessionReportService.test.ts',
    'tests/application/configuration/ConfigurationEngineIntegration.test.ts',
    'tests/application/session-startup/SessionStartupReportService.test.ts',
    'tests/application/session-startup/SessionStartupWizard.test.ts',
    'tests/application/operator-hud/OperatorHUDReportService.test.ts',
    'tests/application/operator-hud/OperatorHUDBuilder.test.ts',
    'tests/application/bootstrap/RuntimeConfigurationLoader.test.ts',
    'tests/application/bootstrap/BootstrapReportService.test.ts',
    'tests/application/bootstrap/ApplicationBootstrap.test.ts'
];

for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf8');

    // add imports if missing
    if (!content.includes('SessionLifecycleManager')) {
        content = "import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';\nimport { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';\n" + content;
    }

    // replace new SessionControlEngine(...) with new SessionControlEngine(..., new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger))
    // We have to be careful with the variables. Sometimes they are eventBus, ledger, sometimes just `new SessionHistory()`.
    // A regex is easier:
    content = content.replace(/new SessionControlEngine\((.*?), (.*?), (.*?)\)/g, "new SessionControlEngine($1, $2, $3, new SessionLifecycleManager(new SessionLifecycleHistory(), $1, $2))");

    // Replace SessionStatus.ACTIVE with 'ACTIVE'
    content = content.replace(/SessionStatus\.ACTIVE/g, "'ACTIVE'");
    content = content.replace(/SessionStatus\.STOP_LOSS_TRIGGERED/g, "'STOP_LOSS_TRIGGERED'");
    content = content.replace(/SessionStatus\.STOP_WIN_TRIGGERED/g, "'STOP_WIN_TRIGGERED'");

    fs.writeFileSync(file, content);
}
