const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    /onClick=\{handleWizardFinish\}\n                                    disabled=\{wizardLoading\}\n                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950\/50"/g,
    `onClick={handleWizardFinish}
                                    disabled={wizardLoading || (startupStatus?.completedStepsCount ?? 0) < 4}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950/50 disabled:opacity-50"`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
