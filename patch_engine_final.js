const fs = require('fs');

let content = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');

// Fix syntax errors
content = content.replace(
    "if (this.lifecycleManager.getCurrentState() === 'ACTIVE) return;",
    "if (this.lifecycleManager.getCurrentState() === 'ACTIVE') return;"
);

content = content.replace(
    "this.lifecycleManager.getCurrentState() = 'ACTIVE;",
    "// this.lifecycleManager.getCurrentState() = 'ACTIVE';"
);

content = content.replace(
    "if (this.lifecycleManager.getCurrentState() === 'FINISHED) return;",
    "if (this.lifecycleManager.getCurrentState() === 'FINISHED') return;"
);

content = content.replace(
    "if (this.lifecycleManager.getCurrentState() !== 'STOP_LOSS_TRIGGERED && this.lifecycleManager.getCurrentState() !== 'STOP_WIN_TRIGGERED) {",
    "if (this.lifecycleManager.getCurrentState() !== 'STOP_LOSS_TRIGGERED' && this.lifecycleManager.getCurrentState() !== 'STOP_WIN_TRIGGERED') {"
);

content = content.replace(
    "this.lifecycleManager.getCurrentState() = 'FINISHED;",
    "// this.lifecycleManager.getCurrentState() = 'FINISHED';"
);

content = content.replace(
    "if (this.lifecycleManager.getCurrentState() !== 'STOP_LOSS_TRIGGERED' && this.lifecycleManager.getCurrentState() !== 'STOP_WIN_TRIGGERED') {\n            // this.lifecycleManager.getCurrentState() = 'FINISHED';\n        }",
    "// removed"
);

fs.writeFileSync('src/application/session-control/SessionControlEngine.ts', content);
