const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    /const text = await fileSelected\.text\(\);\n            const numbers = text\.split\(\/\[\\\\s,\;\\\\n\]\+\/\)\.map\(n => parseInt\(n\)\)\.filter\(n => !isNaN\(n\) && n >= 0 && n <= 36\);\n            \n            await fetch\('\/api\/operator\/startup\/sync', \{\n                method: 'POST',\n                headers: \{ 'Content-Type': 'application\/json' \},\n                body: JSON\.stringify\(\{ numbers \}\)\n            \}\);/g,
    `const text = await fileSelected.text();
            const numbers = text.split(/[\\s,;\\n]+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 0 && n <= 36);
            
            const res = await fetch('/api/operator/startup/sync', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers })
            });
            const data = await res.json();
            if (!data.success) throw new Error("Sync failed");`
);

content = content.replace(
    /await fetch\('\/api\/operator\/startup\/warmup', \{ method: 'POST' \}\);\n            setWizardStep\(5\);/g,
    `const res = await fetch('/api/operator/startup/warmup', { method: 'POST' });
            const data = await res.json();
            if (!data.success) throw new Error("Warmup failed");
            setWizardStep(5);`
);

content = content.replace(
    /const res = await fetch\('\/api\/operator\/startup\/finish', \{ method: 'POST' \}\);\n            const data = await res\.json\(\);\n            if \(data\.success\) \{/g,
    `const res = await fetch('/api/operator/startup/finish', { method: 'POST' });
            const data = await res.json();
            if (data.success) {`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
