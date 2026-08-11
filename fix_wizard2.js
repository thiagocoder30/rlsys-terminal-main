const fs = require('fs');
let content = fs.readFileSync('src/application/session-startup/SessionStartupWizard.ts', 'utf8');

content = content.replace(
    "runtimeReady: true",
    "runtimeReady: true,\n            config: this.configurationEngine ? this.configurationEngine.getCurrentConfiguration() : undefined"
);

fs.writeFileSync('src/application/session-startup/SessionStartupWizard.ts', content);
