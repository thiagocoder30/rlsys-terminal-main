const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

// For CONTINUE_CLICKED
content = content.replace(
    'setShowResumePrompt(false);\n                                setIsConfiguring(false);',
    'console.log("CONTINUE_CLICKED");\n                                setShowResumePrompt(false);\n                                setIsConfiguring(false);'
);

// For NEW_SESSION_CLICKED
content = content.replace(
    'setShowResumePrompt(false);\n                                setForceWizard(true);',
    'console.log("NEW_SESSION_CLICKED");\n                                setShowResumePrompt(false);\n                                setForceWizard(true);'
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
