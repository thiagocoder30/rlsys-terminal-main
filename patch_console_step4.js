const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

content = content.replace(
    /const handleWizardWarmup = async \(\) => \{[\s\S]*?\n    \};\n/g,
    `const handleWizardWarmup = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const res = await fetch('/api/operator/startup/warmup', { method: 'POST' });
            const data = await res.json();
            if (!data.success) {
                setConfigMsg(data.status?.failureReason || 'Falha no aquecimento.');
            }
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };\n`
);

// also fix error msg in step 4 UI
content = content.replace(
    /                                <button\n                                    onClick=\{handleWizardWarmup\}\n                                    disabled=\{wizardLoading\}\n                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"\n                                >\n                                    \{wizardLoading \? \(\n                                        <span>Executando Warmup\.\.\.<\/span>\n                                    \) : \(\n                                        <><span>Executar Aquecimento \(Warmup\)<\/span> <ArrowRight className="w-4 h-4" \/><\/>\n                                    \)\}\n                                <\/button>\n                            <\/div>/,
    `                                <button
                                    onClick={handleWizardWarmup}
                                    disabled={wizardLoading}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"
                                >
                                    {wizardLoading ? (
                                        <span>Executando Warmup...</span>
                                    ) : (
                                        <><span>Executar Aquecimento (Warmup)</span> <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                                {configMsg && <div className="text-rose-400 text-xs text-left bg-black p-2 border border-rose-900 rounded">{configMsg}</div>}
                            </div>`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
