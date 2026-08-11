const fs = require('fs');
let content = fs.readFileSync('tests/application/session-startup/SessionStartupWizard.test.ts', 'utf8');

content = content.replace(
    /const syncOk = await wizard\.executeSync\('OP-001'\);/g,
    `const syncOk = await wizard.executeSync(new Array(200).fill(0), 'OP-001');`
);

// also wait, executeSync takes numbers: number[] = [], operatorId: string
// if it passed 'OP-001' as the first argument, it might have been failing because it thought it was numbers? No, typescript would complain.
// wait, the signature in `executeSync` in `SessionStartupWizard.ts` was `executeSync(numbers: number[] = [], operatorId: string = 'OP-CORE-001')`.

fs.writeFileSync('tests/application/session-startup/SessionStartupWizard.test.ts', content);
