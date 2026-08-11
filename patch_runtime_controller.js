const fs = require('fs');

let content = fs.readFileSync('src/infrastructure/http/controllers/RuntimeController.ts', 'utf8');

content = content.replace(
    "import { SessionReportService } from '../../application/session-control/SessionReportService';",
    "import { SessionReportService } from '../../application/session-control/SessionReportService';\nimport { SessionLifecycleManager } from '../../application/session-lifecycle/SessionLifecycleManager';\nimport { SessionLifecycleHistory } from '../../application/session-lifecycle/SessionLifecycleHistory';\nimport { SessionLifecycleReportService } from '../../application/session-lifecycle/SessionLifecycleReportService';"
);

content = content.replace(
    "public readonly sessionHistoryEngine = new SessionHistory();",
    "public readonly sessionHistoryEngine = new SessionHistory();\n    public readonly sessionLifecycleHistory = new SessionLifecycleHistory();\n    public readonly sessionLifecycleManager = new SessionLifecycleManager(this.sessionLifecycleHistory, this.eventBus, this.ledger);\n    public readonly sessionLifecycleReportService = new SessionLifecycleReportService(this.sessionLifecycleManager);"
);

content = content.replace(
    "new SessionControlEngine(this.eventBus, this.ledger, this.sessionHistoryEngine)",
    "new SessionControlEngine(this.eventBus, this.ledger, this.sessionHistoryEngine, this.sessionLifecycleManager)"
);

content = content.replace(
    "this.sessionControlEngine,\n        this.sessionStartupWizard",
    "this.sessionControlEngine,\n        this.sessionStartupWizard,\n        this.sessionLifecycleManager"
);

fs.writeFileSync('src/infrastructure/http/controllers/RuntimeController.ts', content);
