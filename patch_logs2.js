const fs = require('fs');

// SessionControlEngine.ts
let content = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');
content = content.replace(
    'public resumeSession(',
    'public resumeSession(operatorId: string = \'OP-CORE-001\'): void {\n        console.log("SESSION_RESUMED");\n        return this.resumeSessionOriginal(operatorId);\n    }\n    public resumeSessionOriginal('
);
// wait, the method is `public resumeSession(): boolean {` or something. Let's check first.
