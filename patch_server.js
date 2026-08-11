const fs = require('fs');
let server = fs.readFileSync('src/infrastructure/http/Server.ts', 'utf8');

server = server.replace(
    "this.app.post('/api/operator/startup/reset', this.operatorController.resetStartup);",
    "this.app.post('/api/operator/startup/reset', this.operatorController.resetStartup);\n    this.app.post('/api/operator/session/resume', this.operatorController.resumeSession);"
);

// We should also look at startSession. OperatorController probably delegates session start to SessionStartupWizard or something?
fs.writeFileSync('src/infrastructure/http/Server.ts', server);
