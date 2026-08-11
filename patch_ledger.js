const fs = require('fs');
const file = 'src/application/session-control/SessionControlEngine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/this\.ledger\.recordDecision\('([^']+)', payload\);/g, "this.ledger.append(this.sessionId, '5.0.0', '$1', JSON.stringify(payload));");

fs.writeFileSync(file, code);
