const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

// Remove provider, theme, language, wizardStep from useState
content = content.replace(/const \[provider, setProvider\] = useState<'Pragmatic' \| 'Evolution'>\('Pragmatic'\);\n/g, "");
content = content.replace(/const \[theme, setTheme\] = useState<'DARK' \| 'LIGHT'>\('DARK'\);\n/g, "");
content = content.replace(/const \[language, setLanguage\] = useState<'pt-BR' \| 'en-US' \| 'es-ES'>\('pt-BR'\);\n/g, "");
content = content.replace(/const \[wizardStep, setWizardStep\] = useState<number>\(1\);\n/g, "");

// We keep customBankrollInput for the actual input field. We can initialize it when configData arrives, but it's better to just use runtimeConfigState?.initialBankroll directly for value if customBankrollInput is empty, or better, always update customBankrollInput when it's not focused, or just let customBankrollInput be purely local and reset after save. Wait, if it's bankrollInput, let's keep it as is, we'll see.
content = content.replace(/const \[bankrollInput, setBankrollInput\] = useState<string>\("1000"\);\n/, "");

// Calculate wizardStep and config states from backend
content = content.replace(
    /const \[customBankrollInput, setCustomBankrollInput\] = useState<string>\(''\);/g,
    `const [customBankrollInput, setCustomBankrollInput] = useState<string>('');
    const [isBankrollFocused, setIsBankrollFocused] = useState<boolean>(false);

    let wizardStep = 1;
    if (startupStatus?.state === 'NOT_STARTED' || startupStatus?.state === 'SELECTING_TABLE') wizardStep = 1;
    else if (startupStatus?.state === 'CONFIGURING_BANKROLL') wizardStep = 2;
    else if (startupStatus?.state === 'SYNCING_HISTORY') wizardStep = 3;
    else if (startupStatus?.state === 'RUNNING_WARMUP') wizardStep = 4;
    else if (startupStatus?.state === 'VALIDATING' || startupStatus?.state === 'READY') wizardStep = 5;

    const provider = runtimeConfigState?.provider === 'EVOLUTION' ? 'Evolution' : 'Pragmatic';
    const theme = runtimeConfigState?.theme || 'DARK';
    const language = runtimeConfigState?.language || 'pt-BR';
    const displayBankroll = isBankrollFocused ? customBankrollInput : (customBankrollInput || runtimeConfigState?.initialBankroll?.toString() || "1000");`
);

// Remove state setters from fetchData
content = content.replace(
    /setRuntimeConfigState\(rtData\);\n                if \(rtData\.provider\) \{\n                    setProvider\(rtData\.provider === 'EVOLUTION' \? 'Evolution' : 'Pragmatic'\);\n                \}\n                if \(rtData\.currentBankroll && rtData\.currentBankroll > 0\) \{\n                    setBankrollInput\(rtData\.currentBankroll\);\n                \}\n                if \(rtData\.theme\) \{\n                    setTheme\(rtData\.theme\);\n                \}\n                if \(rtData\.language\) \{\n                    setLanguage\(rtData\.language\);\n                \}/g,
    `setRuntimeConfigState(rtData);`
);

// We need to change references of bankrollInput to customBankrollInput or displayBankroll
content = content.replace(/bankrollInput\.toString\(\)/g, "displayBankroll.toString()");
content = content.replace(/value=\{bankrollInput\}/g, "value={displayBankroll}\n                                        onFocus={() => setIsBankrollFocused(true)}\n                                        onBlur={() => setIsBankrollFocused(false)}");

content = content.replace(/setBankrollInput\(val\)/g, "setCustomBankrollInput(val)");

// Update handleProviderChange, etc., to not use setProvider
content = content.replace(/setProvider\(prov\);\n/g, "");
content = content.replace(/setTheme\(newTheme\);\n/g, "");
content = content.replace(/setLanguage\(newLang\);\n/g, "");

content = content.replace(/setWizardStep\(2\);/g, "");
content = content.replace(/setWizardStep\(3\);/g, "");
content = content.replace(/setWizardStep\(4\);/g, "");
content = content.replace(/setWizardStep\(5\);/g, "");
content = content.replace(/setWizardStep\(1\);/g, "");

content = content.replace(/\|\| bankrollInput <= 0/g, "|| Number(displayBankroll.toString().replace(/[^0-9.-]+/g,'')) <= 0");
content = content.replace(/\|\| bankrollInput\}/g, "|| displayBankroll}");

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
