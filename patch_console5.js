const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    /const handleWizardConfirmPreferences = async \(\) => \{[\s\S]*?\n    \};\n/g,
    `const handleWizardConfirmPreferences = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            await fetch('/api/operator/startup/select-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: provider === 'Evolution' ? 'EVOLUTION' : 'PRAGMATIC' })
            });
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };\n`
);

content = content.replace(
    /const handleWizardConfigureBankroll = async \(\) => \{[\s\S]*?\n    \};\n/g,
    `const handleWizardConfigureBankroll = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const amount = Number(displayBankroll.toString().replace(/[^0-9.-]+/g,""));
            if (amount <= 0) throw new Error("Invalid");
            await fetch('/api/operator/startup/configure-bankroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };\n`
);

content = content.replace(
    /const handleWizardFinish = async \(\) => \{[\s\S]*?\n    \};\n/g,
    `const handleWizardFinish = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            await fetch('/api/operator/startup/finish', { method: 'POST' });
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };\n`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
