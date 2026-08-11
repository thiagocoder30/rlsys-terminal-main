const fs = require('fs');

let content = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');

content = content.replace(
    "if (this.lifecycleManager.getCurrentState() === 'FINISHED') return;",
    "// removed"
);

fs.writeFileSync('src/application/session-control/SessionControlEngine.ts', content);
