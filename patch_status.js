const fs = require('fs');
const file = 'src/application/session-control/SessionControlEngine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("this.status = SessionStatus.FINISHED;", `
        if (this.status !== SessionStatus.STOP_LOSS_TRIGGERED && this.status !== SessionStatus.STOP_WIN_TRIGGERED) {
            this.status = SessionStatus.FINISHED;
        }
`);

fs.writeFileSync(file, code);
