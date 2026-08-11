const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    /const \[isTerminalExpanded, setIsTerminalExpanded\] = useState\(false\);\n\s*const \[customBankrollInput, setCustomBankrollInput\] = useState<string>\(''\);/g,
    `const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
    const [customBankrollInput, setCustomBankrollInput] = useState<string>('');
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

content = content.replace(
    /const \[isTerminalExpanded, setIsTerminalExpanded\] = useState\(false\);\n\s*const availableCommands/g,
    `const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
    const [customBankrollInput, setCustomBankrollInput] = useState<string>('');
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
    const displayBankroll = isBankrollFocused ? customBankrollInput : (customBankrollInput || runtimeConfigState?.initialBankroll?.toString() || "1000");

    const availableCommands`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
