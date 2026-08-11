const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

// Fix handleBankrollChange to just set the local state.
content = content.replace(
    /const handleBankrollChange = async \(val: string\) => \{[\s\S]*?\n    \};\n/g,
    `const handleBankrollChange = (val: string) => {
        setCustomBankrollInput(val);
    };\n`
);

// Fix the config tab bankroll to remove the button array and just leave the input + APLICAR button.
const buttonsRegex = /<div className="flex gap-2">\s*\{\[500, 1000, 1250, 2500, 5000\]\.map[\s\S]*?<\/div>/;
content = content.replace(buttonsRegex, '');

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
