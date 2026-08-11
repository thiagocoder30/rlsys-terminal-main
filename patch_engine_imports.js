const fs = require('fs');

let content = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');

content = content.replace(
    "import { SessionStatus, TableConfiguration, TableProvider } from './SessionState';",
    "import { SessionStatus, TableConfiguration, TableProvider } from './SessionState';\nimport { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';"
);

// We need to fix the status references that I missed.
content = content.replace(/this\.status/g, "this.lifecycleManager.getCurrentState()");
content = content.replace(/SessionStatus\./g, "'"); // ACTIVE -> 'ACTIVE'
// wait, if I replace SessionStatus.ACTIVE with 'ACTIVE', it will be "'ACTIVE'".
content = content.replace(/SessionStatus\.ACTIVE/g, "'ACTIVE'");
content = content.replace(/SessionStatus\.FINISHED/g, "'FINISHED'");
content = content.replace(/SessionStatus\.STOP_LOSS_TRIGGERED/g, "'STOP_LOSS_TRIGGERED'");
content = content.replace(/SessionStatus\.STOP_WIN_TRIGGERED/g, "'STOP_WIN_TRIGGERED'");

fs.writeFileSync('src/application/session-control/SessionControlEngine.ts', content);
