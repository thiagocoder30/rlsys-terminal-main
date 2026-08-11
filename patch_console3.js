const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

// The duplicate insertion needs to be removed.
const block = `    const [customBankrollInput, setCustomBankrollInput] = useState<string>('');
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
    const displayBankroll = isBankrollFocused ? customBankrollInput : (customBankrollInput || runtimeConfigState?.initialBankroll?.toString() || "1000");`;

// split by this block and keep only the first one
const parts = content.split(block);
if (parts.length > 2) {
    content = parts[0] + block + parts.slice(1).join("");
}

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
