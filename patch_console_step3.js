const fs = require('fs');
let content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

// Replace Step 3
content = content.replace(
    /\{wizardStep === 3 && \([\s\S]*?<\/div>\n                        \)\}/,
    `{wizardStep === 3 && (
                            <div className="space-y-3 text-center">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">PASSO 3 DE 5 — SINCRONIZAÇÃO DE GIROS</div>
                                <p className="text-xs text-gray-400">Insira a lista dos últimos giros para preencher o buffer (min 200).</p>
                                <textarea
                                    className="w-full h-24 bg-black border border-gray-700 p-2 text-xs font-mono text-gray-300 rounded focus:border-purple-500 focus:outline-none"
                                    placeholder="Ex: 0,32,15,19,4,21..."
                                    value={cmdInput}
                                    onChange={(e) => setCmdInput(e.target.value)}
                                ></textarea>
                                <button
                                    onClick={() => handleWizardSync(cmdInput)}
                                    disabled={wizardLoading}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                                >
                                    {wizardLoading ? (
                                        <span>Sincronizando histórico...</span>
                                    ) : (
                                        <><span>Sincronizar (Min 200 Giros)</span> <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                                {configMsg && <div className="text-rose-400 text-xs text-left bg-black p-2 border border-rose-900 rounded">{configMsg}</div>}
                            </div>
                        )}`
);

content = content.replace(
    /const handleWizardSync = async \(\) => \{[\s\S]*?\n    \};\n/g,
    `const handleWizardSync = async (inputStr?: string) => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const rawNumbers = (inputStr || "").split(/[,\\s]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
            const res = await fetch('/api/operator/startup/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers: rawNumbers })
            });
            const data = await res.json();
            if (!data.success) {
                setConfigMsg(data.status?.failureReason || 'Falha na sincronização. Quantidade de giros insuficiente.');
            }
        } catch (err: any) {
             setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };\n`
);

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content);
