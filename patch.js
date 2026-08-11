const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    'setShowResumePrompt(true);',
    'console.log("SESSION_FOUND"); setShowResumePrompt(true);'
);

content = content.replace(
    'Nova Sessão',
    'Nova Sessão'
);
// let's do this more carefully.
