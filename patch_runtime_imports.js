const fs = require('fs');

let content = fs.readFileSync('src/infrastructure/http/controllers/RuntimeController.ts', 'utf8');

content = content.replace(
    "import { SessionReportService } from '../../application/session-control/SessionReportService';",
    "import { SessionReportService } from '../../application/session-control/SessionReportService';\nimport { SessionLifecycleManager } from '../../application/session-lifecycle/SessionLifecycleManager';\nimport { SessionLifecycleHistory } from '../../application/session-lifecycle/SessionLifecycleHistory';\nimport { SessionLifecycleReportService } from '../../application/session-lifecycle/SessionLifecycleReportService';"
);

fs.writeFileSync('src/infrastructure/http/controllers/RuntimeController.ts', content);
