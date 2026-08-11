import React, { useState, useEffect, useRef } from 'react';
import { Play, SkipForward, Check, Shield, Activity, Terminal, BarChart2, History, TrendingUp, Cpu, ChevronUp, ChevronDown, CheckCircle2, ArrowRight, RotateCcw, AlertTriangle, Flame, Snowflake, ShieldAlert } from 'lucide-react';
import { SessionStateDTO, OperatorHUDSnapshotDTO, SessionAuditDTO, AuditPerformanceReportDTO, SessionAuditSnapshotDTO, OperatorPerformanceProfileDTO, StartupStatusDTO, OperationalConfigurationDTO } from '../core/dto';

export const OperatorConsole: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'TERMINAL' | 'STATS' | 'WEIGHTS' | 'CONFIG'>('TERMINAL');
    const [sessionState, setSessionState] = useState<SessionStateDTO | null>(null);
    const [hudState, setHudState] = useState<OperatorHUDSnapshotDTO | null>(null);
    const [history, setHistory] = useState<SessionAuditDTO[]>([]);
    const [auditHistory, setAuditHistory] = useState<SessionAuditSnapshotDTO[]>([]);
    const [performanceReport, setPerformanceReport] = useState<AuditPerformanceReportDTO | null>(null);
    const [profile, setProfile] = useState<OperatorPerformanceProfileDTO | null>(null);
    const [latestInsight, setLatestInsight] = useState<string | null>(null);
    const [startupStatus, setStartupStatus] = useState<StartupStatusDTO | null>(null);
    const [configData, setConfigData] = useState<OperationalConfigurationDTO | null>(null);
    const [configLoading, setConfigLoading] = useState(false);
    const [configMsg, setConfigMsg] = useState<string | null>(null);
    
    // For manual setup in UI
    const hasCheckedResumeRef = useRef(false);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [bootstrapStatus, setBootstrapStatus] = useState<any>(null);
    const [runtimeConfigState, setRuntimeConfigState] = useState<any>(null);
    const [isConfiguring, setIsConfiguring] = useState(true);
    const [fileSelected, setFileSelected] = useState<File | null>(null);
                    const [wizardLoading, setWizardLoading] = useState(false);
    const [spinInput, setSpinInput] = useState<string>('');
    const [spinLoading, setSpinLoading] = useState<boolean>(false);
    const [cmdInput, setCmdInput] = useState('');

    const handleInjectSpin = async () => {
        if (!spinInput.trim()) return;
        const num = parseInt(spinInput.trim(), 10);
        if (isNaN(num) || num < 0 || num > 36) return;
        setSpinLoading(true);
        try {
            const res = await fetch('/api/operator/session/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result: num })
            });
            if (res.ok) {
                setSpinInput('');
                await fetchData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSpinLoading(false);
        }
    };
    const [cmdLog, setCmdLog] = useState<string[]>([]);
    const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
    const [customBankrollInput, setCustomBankrollInput] = useState<string>('');
    const [isBankrollFocused, setIsBankrollFocused] = useState<boolean>(false);

    const [visualWizardStep, setVisualWizardStep] = useState<number>(1);
    const [userHasNavigated, setUserHasNavigated] = useState<boolean>(false);

    let maxAllowedStep = 1;
    if (startupStatus) {
        if (startupStatus.completedStepsCount >= 1 || startupStatus.state === 'CONFIGURING_BANKROLL') maxAllowedStep = Math.max(maxAllowedStep, 2);
        if (startupStatus.completedStepsCount >= 2 || startupStatus.state === 'SYNCING_HISTORY') maxAllowedStep = Math.max(maxAllowedStep, 3);
        if (startupStatus.completedStepsCount >= 3 || startupStatus.state === 'RUNNING_WARMUP') maxAllowedStep = Math.max(maxAllowedStep, 4);
        if (startupStatus.completedStepsCount >= 4 || startupStatus.state === 'VALIDATING' || startupStatus.state === 'READY') maxAllowedStep = Math.max(maxAllowedStep, 5);
    }

    useEffect(() => {
        if (!userHasNavigated && maxAllowedStep > visualWizardStep) {
            setVisualWizardStep(maxAllowedStep);
        }
    }, [maxAllowedStep, userHasNavigated]);

    const provider = runtimeConfigState?.provider === 'EVOLUTION' ? 'Evolution' : 'Pragmatic';
    const theme = runtimeConfigState?.theme || 'DARK';
    const language = runtimeConfigState?.language || 'pt-BR';
    const displayBankroll = isBankrollFocused ? customBankrollInput : (customBankrollInput || runtimeConfigState?.initialBankroll?.toString() || "1000");

    const availableCommands = ['sync', 'setbankroll', 'status', 'history', 'audit', 'warmup', 'help', 'clear'];
    
    // Polling
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 1500);
        return () => clearInterval(interval);
    }, []);

    const safeFetch = async (url: string) => {
        try {
            return await fetch(url);
        } catch {
            return null;
        }
    };

    const safeJson = async (res: Response | null) => {
        if (!res || !res.ok) return null;
        try {
            const ct = res.headers.get('content-type');
            if (ct && ct.includes('application/json')) {
                return await res.json();
            }
        } catch {
            return null;
        }
        return null;
    };

    const fetchData = async () => {
        try {
            const [curRes, hudRes, histRes, auditHistRes, perfRes, profRes, insRes, startupRes, configRes, bootRes, rtConfigRes] = await Promise.all([
                safeFetch('/api/operator/session/current'),
                safeFetch('/api/operator/hud/current'),
                safeFetch('/api/operator/session/history'),
                safeFetch('/api/operator/session-audit/history'),
                safeFetch('/api/operator/session-audit/performance'),
                safeFetch('/api/operator/session-intelligence/profile'),
                safeFetch('/api/operator/session-intelligence/insights'),
                safeFetch('/api/operator/startup/status'),
                safeFetch('/api/operator/configuration'),
                safeFetch('/api/operator/bootstrap/status'),
                safeFetch('/api/operator/runtime-configuration')
            ]);
            
            const sessionObj = await safeJson(curRes);
            if (sessionObj) {
                setSessionState(sessionObj);
                if (sessionObj.status === 'ACTIVE' && !hasCheckedResumeRef.current) {
                    setIsConfiguring(false);
                }
            }

            const bootData = await safeJson(bootRes);
            if (bootData) {
                setBootstrapStatus(bootData);
                if (!hasCheckedResumeRef.current) {
                    if (bootData.decision === 'READY_FOR_STARTUP') {
                        setIsConfiguring(true);
                        setShowResumePrompt(false);
                    } else if (bootData.decision === 'PROMPT_RESUME') {
                        setIsConfiguring(false);
                        setShowResumePrompt(true);
                    } else if (bootData.decision === 'READY_FOR_SESSION') {
                        setIsConfiguring(true);
                        setShowResumePrompt(false);
                    }
                    hasCheckedResumeRef.current = true;
                }
            }

            const rtData = await safeJson(rtConfigRes);
            if (rtData) {
                setRuntimeConfigState(rtData);
            }

            const hudData = await safeJson(hudRes);
            if (hudData) setHudState(hudData);

            const histData = await safeJson(histRes);
            if (histData) setHistory(histData);

            const auditData = await safeJson(auditHistRes);
            if (auditData) setAuditHistory(auditData);

            const perfData = await safeJson(perfRes);
            if (perfData) setPerformanceReport(perfData);

            const profData = await safeJson(profRes);
            if (profData) setProfile(profData);

            const insData = await safeJson(insRes);
            if (insData && insData.insights && insData.insights.length > 0) {
                setLatestInsight(insData.insights[0]);
            }

            const startupData = await safeJson(startupRes);
            if (startupData) setStartupStatus(startupData);

            const configResultData = await safeJson(configRes);
            if (configResultData) setConfigData(configResultData);
        } catch (e) {
            console.error('Failed to fetch data', e);
        } finally {
            setIsBootstrapping(false);
        }
    };

    const handleWizardConfirmPreferences = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            await fetch('/api/operator/startup/select-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: provider === 'Evolution' ? 'EVOLUTION' : 'PRAGMATIC' })
            });
            setUserHasNavigated(false);
            setVisualWizardStep(2);
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };

    const handleProviderChange = async (prov: 'Pragmatic' | 'Evolution') => {
        await fetch('/api/operator/configuration/provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: prov === 'Evolution' ? 'EVOLUTION' : 'PRAGMATIC' })
        });
        fetchData();
    };

    const handleThemeChange = async (newTheme: 'DARK' | 'LIGHT') => {
        await handleSaveConfig({ theme: newTheme });
        fetchData();
    };

    const handleLanguageChange = async (newLang: 'pt-BR' | 'en-US' | 'es-ES') => {
        await handleSaveConfig({ language: newLang });
        fetchData();
    };
    
    const parseBankroll = (val: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let cleaned = val.toString().replace(/[^0-9.,]/g, '').trim();
        if (!cleaned) return 0;
        if (cleaned.includes('.') && cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',')) {
            cleaned = cleaned.replace(',', '.');
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const handleBankrollChange = (val: string) => {
        setCustomBankrollInput(val);
    };

    const handleWizardConfigureBankroll = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const amount = parseBankroll(displayBankroll);
            if (amount <= 0) throw new Error("Banca inicial deve ser maior que zero.");
            const provPayload = (provider === 'Evolution') ? 'EVOLUTION' : 'PRAGMATIC';
            const res = await fetch('/api/operator/startup/configure-bankroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, provider: provPayload })
            });
            const data = await res.json();
            if (res.ok && data.success !== false) {
                setUserHasNavigated(false);
                setVisualWizardStep(3);
                await fetchData();
            } else {
                setConfigMsg(data?.error || data?.status?.failureReason || "Falha ao configurar banca.");
            }
        } catch (err: any) {
            setConfigMsg(err?.message || "Erro de conexão ao salvar banca.");
        } finally {
            setWizardLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileSelected(e.target.files[0]);
        }
    };

    const handleWizardSync = async (inputStr?: string) => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const rawNumbers = (inputStr || "").split(/[,\s]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
            const res = await fetch('/api/operator/startup/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers: rawNumbers })
            });
            const data = await res.json();
            if (!data.success) {
                setConfigMsg(data.status?.failureReason || 'Falha na sincronização. Quantidade de giros insuficiente.');
            } else {
                setUserHasNavigated(false);
                setVisualWizardStep(4);
            }
        } catch (err: any) {
             setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };

    const handleWizardWarmup = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const res = await fetch('/api/operator/startup/warmup', { method: 'POST' });
            const data = await res.json();
            if (!data.success) {
                setConfigMsg(data.status?.failureReason || 'Falha no aquecimento.');
            } else {
                setUserHasNavigated(false);
                setVisualWizardStep(5);
            }
        } catch (err: any) {
            setConfigMsg(err.message);
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };

    const handleWizardFinish = async () => {
        setWizardLoading(true);
        setConfigMsg(null);
        try {
            const res = await fetch('/api/operator/startup/finish', { method: 'POST' });
            const contentType = res.headers.get("content-type");
            if (!res.ok && (!contentType || !contentType.includes("application/json"))) {
                throw new Error(`Erro no servidor: Status ${res.status}`);
            }
            let data: any = {};
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                throw new Error("O servidor não retornou um JSON válido. Verifique se a rota da API existe.");
            }
            if (data.success !== false) {
                hasCheckedResumeRef.current = true;
                setShowResumePrompt(false);
                setIsConfiguring(false);
                await fetchData();
            } else {
                setConfigMsg(data.error || data.status?.failureReason || 'Falha na validação final.');
            }
        } catch (err: any) {
            setConfigMsg(err?.message || 'Falha na validação final.');
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };

    const handleWizardReset = async () => {
        setWizardLoading(true);
        try {
            await fetch('/api/operator/startup/reset', { method: 'POST' });
            
        } finally {
            setWizardLoading(false);
            fetchData();
        }
    };



    const handleSaveConfig = async (partial: Partial<OperationalConfigurationDTO>) => {
        setConfigLoading(true);
        setConfigMsg(null);
        try {
            const res = await fetch('/api/operator/configuration/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(partial)
            });
            if (res.ok) {
                const data: OperationalConfigurationDTO = await res.json();
                setConfigData(data);
                setConfigMsg('Configuração aplicada com sucesso');

                if (data.theme === 'LIGHT') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                } else if (data.theme === 'DARK') {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                }
            } else {
                const err = await res.json();
                setConfigMsg(`Configuração inválida: ${err.error || 'Erro de validação'}`);
            }
        } catch (e: any) {
            setConfigMsg(`Configuração inválida: ${e.message}`);
        } finally {
            setConfigLoading(false);
        }
    };

    const handleStartSession = async () => {
        const minChip = provider === 'Pragmatic' ? 0.10 : 0.50;
        await fetch('/api/operator/session/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initialBankroll: displayBankroll, provider, minimumChipValue: minChip })
        });
        setIsConfiguring(false);
        fetchData();
    };

    const handleConfirm = async () => {
        await fetch('/api/operator/suggestion/confirm', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionState?.sessionId,
                roundId: sessionState?.metrics.totalRounds || 0,
                strategy: hudState?.data.strategySuggestion || 'N/A',
                stake: hudState?.data.stakeValue || 0
            })
        });
        await fetch('/api/operator/session/confirm', { method: 'POST' });
        
        setCmdLog(prev => [...prev, `[HUD] Entrada registrada. Strategy: ${hudState?.data.strategySuggestion} - R$ ${hudState?.data.stakeValue}`]);
        fetchData();
    };

    const handleSkip = async () => {
        await fetch('/api/operator/suggestion/skip', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionState?.sessionId,
                roundId: sessionState?.metrics.totalRounds || 0,
                strategy: hudState?.data.strategySuggestion || 'N/A',
                stake: hudState?.data.stakeValue || 0
            })
        });
        await fetch('/api/operator/session/skip', { method: 'POST' });
        
        setCmdLog(prev => [...prev, `[HUD] Entrada ignorada.`]);
        fetchData();
    };

    const handleTerminalCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const cmd = cmdInput.trim();
            if (!cmd) return;
            setCmdLog(prev => [...prev, `> ${cmd}`]);
            setCmdInput('');

            if (cmd === 'clear') {
                setCmdLog([]);
                return;
            }

            try {
                const res = await fetch('/api/operator/terminal/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: cmd })
                });
                if (res.ok) {
                    const result = await res.json();
                    setCmdLog(prev => [...prev, result.output]);
                } else {
                    setCmdLog(prev => [...prev, '[ERROR] Falha na comunicação com o terminal backend.']);
                }
            } catch (err) {
                setCmdLog(prev => [...prev, '[ERROR] Erro na execução do comando.']);
            }
            fetchData();
        }
    };

    if (isBootstrapping) {
        return (
            <div className="min-h-screen bg-black text-gray-200 p-3 md:p-6 font-mono flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-pulse" /> Carregando ambiente...
                </div>
            </div>
        );
    }

    if (showResumePrompt) {
        return (
            <div className="min-h-screen bg-black text-gray-200 p-3 md:p-6 font-mono flex items-center justify-center">
                <div className="w-full max-w-sm bg-gray-900 border border-purple-900/60 p-6 rounded-2xl space-y-6 shadow-2xl shadow-purple-950/30 text-center">
                    <Shield className="w-12 h-12 text-purple-400 mx-auto" />
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-white tracking-wide">Sessão Ativa Detectada</h2>
                        <p className="text-xs text-gray-400">Deseja continuar utilizando a configuração atual ou iniciar uma nova sessão?</p>
                    </div>
                    <div className="space-y-3">
                        <button 
                            onClick={async () => {
                                await fetch('/api/operator/session/resume', { method: 'POST' });
                                setShowResumePrompt(false);
                                setIsConfiguring(false);
                                fetchData();
                            }}
                            className="w-full bg-emerald-950/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-900 font-bold py-3 rounded-xl transition"
                        >
                            Continuar Sessão
                        </button>
                        <button 
                            onClick={async () => {
                                console.log("NEW_SESSION_CLICKED");
                                setShowResumePrompt(false);
                                setIsConfiguring(true);
                                
                                await fetch('/api/operator/startup/reset', { method: 'POST' });
                                fetchData();
                            }}
                            className="w-full bg-gray-950 border border-gray-800 text-gray-400 hover:bg-gray-800 font-bold py-3 rounded-xl transition"
                        >
                            Nova Sessão
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isConfiguring || !sessionState) {
        const pct = startupStatus?.percentage ?? 0;
        const state = startupStatus?.state ?? 'NOT_STARTED';

        return (
            <div className="min-h-screen bg-black text-gray-200 p-2 sm:p-3 md:p-6 font-mono flex items-center justify-center pb-16 pt-2">
                <div className="w-full max-w-md bg-gray-900 border border-purple-900/60 p-4 sm:p-5 rounded-2xl space-y-4 sm:space-y-5 shadow-2xl shadow-purple-950/30 max-h-[92vh] overflow-y-auto">
                    {/* Header */}
                    <div className="text-center space-y-1 border-b border-gray-800 pb-3">
                        <div className="text-[10px] text-purple-400 font-bold tracking-widest uppercase flex items-center justify-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-purple-400" /> SPRINT-047 — SSWA
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-wide">ASSISTENTE DE INICIALIZAÇÃO</h1>
                        <p className="text-xs text-gray-400">Fluxo guiado de preparação institucional para a sessão</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-400 font-bold">
                            <span>Progresso do Wizard</span>
                            <span className="text-purple-400">{pct}% ({startupStatus?.completedStepsCount ?? 0}/{startupStatus?.totalStepsCount ?? 5} etapas)</span>
                        </div>
                        <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-gray-800">
                            <div 
                                className="h-full bg-gradient-to-r from-purple-700 to-emerald-500 transition-all duration-500 rounded-full"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    {/* Steps Breadcrumb / Pills */}
                    <div className="grid grid-cols-5 gap-1.5 text-[10px] text-center font-bold">
                        {[
                            { id: 1, label: '1. Mesa' },
                            { id: 2, label: '2. Banca' },
                            { id: 3, label: '3. Sync' },
                            { id: 4, label: '4. Warmup' },
                            { id: 5, label: '5. Review' }
                        ].map((stepItem) => {
                            const isCurrent = visualWizardStep === stepItem.id;
                            const isUnlocked = stepItem.id <= maxAllowedStep;
                            return (
                                <button
                                    key={stepItem.id}
                                    type="button"
                                    disabled={!isUnlocked}
                                    onClick={() => {
                                        if (isUnlocked) {
                                            setVisualWizardStep(stepItem.id);
                                            setUserHasNavigated(true);
                                        }
                                    }}
                                    className={`p-2 rounded-lg border transition text-center ${
                                        isCurrent
                                            ? 'bg-purple-950 border-purple-500 text-purple-200 shadow-md shadow-purple-950/50'
                                            : isUnlocked
                                            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60 cursor-pointer'
                                            : 'bg-black/60 border-gray-800 text-gray-600 cursor-not-allowed opacity-60'
                                    }`}
                                >
                                    {stepItem.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Error Box */}
                    {state === 'FAILED' && (
                        <div className="bg-rose-950/40 border border-rose-800/80 p-3 rounded-xl space-y-2 text-xs text-rose-200">
                            <div className="flex items-center gap-2 font-bold text-rose-400">
                                <AlertTriangle className="w-4 h-4" /> FALHA NA INICIALIZAÇÃO
                            </div>
                            <p>{startupStatus?.failureReason || 'Ocorreu um erro durante a preparação da sessão.'}</p>
                            <button 
                                onClick={handleWizardReset}
                                className="w-full bg-rose-900 hover:bg-rose-800 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Assistente
                            </button>
                        </div>
                    )}

                    {/* Step Content */}
                    <div className="bg-black/70 border border-gray-800 rounded-xl p-4 space-y-4">
                        {visualWizardStep === 1 && (
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">PASSO 1 DE 5 — PREFERÊNCIAS INSTITUCIONAIS</div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Provedor de Mesa</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleProviderChange('Pragmatic')}
                                            disabled={wizardLoading}
                                            className={`p-2.5 rounded-xl border text-left transition ${provider === 'Pragmatic' ? 'bg-purple-950/80 border-purple-500 text-white' : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-300'}`}
                                        >
                                            <div className="font-bold text-xs">Pragmatic</div>
                                            <div className="text-[9px] text-gray-400 mt-1">Mínimo: R$ 0,10</div>
                                        </button>
                                        <button
                                            onClick={() => handleProviderChange('Evolution')}
                                            disabled={wizardLoading}
                                            className={`p-2.5 rounded-xl border text-left transition ${provider === 'Evolution' ? 'bg-purple-950/80 border-purple-500 text-white' : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-300'}`}
                                        >
                                            <div className="font-bold text-xs">Evolution</div>
                                            <div className="text-[9px] text-gray-400 mt-1">Mínimo: R$ 0,50</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase">Idioma (I18N)</label>
                                        <select 
                                            value={configData?.language || language}
                                            onChange={(e) => handleSaveConfig({ language: e.target.value as any })}
                                            disabled={wizardLoading || configLoading}
                                            className="w-full bg-gray-900 border border-gray-700 text-white text-xs p-2.5 rounded-xl outline-none focus:border-purple-500 cursor-pointer"
                                        >
                                            <option value="pt-BR" className="bg-gray-900 text-white">Português (BR)</option>
                                            <option value="en-US" className="bg-gray-900 text-white">English (US)</option>
                                            <option value="es-ES" className="bg-gray-900 text-white">Español (ES)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase">Tema de Interface</label>
                                        <select 
                                            value={configData?.theme || theme}
                                            onChange={(e) => handleSaveConfig({ theme: e.target.value as any })}
                                            disabled={wizardLoading || configLoading}
                                            className="w-full bg-gray-900 border border-gray-700 text-white text-xs p-2.5 rounded-xl outline-none focus:border-purple-500 cursor-pointer"
                                        >
                                            <option value="DARK" className="bg-gray-900 text-white">Terminal Escuro</option>
                                            <option value="LIGHT" className="bg-gray-900 text-white">Institucional Claro</option>
                                            <option value="SYSTEM" className="bg-gray-900 text-white">Sistema</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    {configMsg && (
                                        <div className="text-rose-400 text-xs text-left bg-black p-2.5 border border-rose-900 rounded-xl mb-2">
                                            {configMsg}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleWizardConfirmPreferences}
                                        disabled={wizardLoading}
                                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"
                                    >
                                        <span>Confirmar e Avançar</span> <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {visualWizardStep === 2 && (
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">PASSO 2 DE 5 — CONFIGURAÇÃO DA BANCA</div>
                                <p className="text-xs text-gray-400">Informe a banca inicial dedicada para a sessão:</p>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-500 font-bold">BANCA INICIAL (R$)</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black border border-gray-700 p-3 rounded-xl text-lg font-bold text-center text-emerald-400 focus:outline-none focus:border-purple-500"
                                        value={displayBankroll}
                                        onFocus={() => setIsBankrollFocused(true)}
                                        onBlur={() => setIsBankrollFocused(false)}
                                        onChange={(e) => handleBankrollChange(e.target.value)}
                                    />
                                </div>
                                {configMsg && (
                                    <div className="text-rose-400 text-xs text-left bg-black p-2.5 border border-rose-900 rounded-xl">
                                        {configMsg}
                                    </div>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setVisualWizardStep(1); setUserHasNavigated(true); }}
                                        className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition text-xs"
                                    >
                                        ◀ Voltar
                                    </button>
                                    <button
                                        onClick={handleWizardConfigureBankroll}
                                        disabled={wizardLoading || parseBankroll(displayBankroll) <= 0}
                                        className="w-2/3 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                                    >
                                        <span>Confirmar Banca e Avançar</span> <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {visualWizardStep === 3 && (
                            <div className="space-y-3 text-center">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">PASSO 3 DE 5 — SINCRONIZAÇÃO DE GIROS</div>
                                <p className="text-xs text-gray-400">Insira a lista dos últimos giros para preencher o buffer (min 200).</p>
                                <textarea
                                    className="w-full h-24 bg-black border border-gray-700 p-2 text-xs font-mono text-gray-300 rounded-xl focus:border-purple-500 focus:outline-none"
                                    placeholder="Ex: 0,32,15,19,4,21..."
                                    value={cmdInput}
                                    onChange={(e) => setCmdInput(e.target.value)}
                                ></textarea>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setVisualWizardStep(2); setUserHasNavigated(true); }}
                                        className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition text-xs"
                                    >
                                        ◀ Voltar
                                    </button>
                                    <button
                                        onClick={() => handleWizardSync(cmdInput)}
                                        disabled={wizardLoading}
                                        className="w-2/3 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                                    >
                                        {wizardLoading ? (
                                            <span>Sincronizando histórico...</span>
                                        ) : (
                                            <><span>Sincronizar (Min 200 Giros)</span> <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                                {configMsg && <div className="text-rose-400 text-xs text-left bg-black p-2 border border-rose-900 rounded">{configMsg}</div>}
                            </div>
                        )}

                        {visualWizardStep === 4 && (
                            <div className="space-y-3 text-center">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">PASSO 4 DE 5 — AQUECIMENTO INSTITUCIONAL</div>
                                <p className="text-xs text-gray-400">Calibre e aqueça os motores quantitativos da plataforma:</p>
                                <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 text-xs text-left font-mono space-y-1">
                                    <div className="text-emerald-400">✓ Sincronização concluída com sucesso</div>
                                    <div className="text-gray-400">• Motores: Cadeias de Markov, Entropia de Shannon, Z-Score</div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setVisualWizardStep(3); setUserHasNavigated(true); }}
                                        className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition text-xs"
                                    >
                                        ◀ Voltar
                                    </button>
                                    <button
                                        onClick={handleWizardWarmup}
                                        disabled={wizardLoading}
                                        className="w-2/3 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs"
                                    >
                                        {wizardLoading ? (
                                            <span>Executando Warmup...</span>
                                        ) : (
                                            <><span>Executar Aquecimento (Warmup)</span> <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                                {configMsg && <div className="text-rose-400 text-xs text-left bg-black p-2 border border-rose-900 rounded">{configMsg}</div>}
                            </div>
                        )}

                        {visualWizardStep === 5 && (
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5 border-b border-gray-800 pb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> PASSO 5 DE 5 — RESUMO & IGNIÇÃO DA SESSÃO
                                </div>
                                
                                <p className="text-xs text-gray-300 text-center">Confira o resumo consolidado antes de iniciar as operações:</p>
                                
                                {/* Consolidated Read-Only Summary with Edit Buttons */}
                                <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 space-y-3 font-mono text-xs">
                                    {/* Item 1: Mesa */}
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-800/60">
                                        <div>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold block">1. Mesa / Provedor</span>
                                            <span className="text-white font-bold">{startupStatus?.tableProvider || provider}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVisualWizardStep(1); setUserHasNavigated(true); }}
                                            className="text-[10px] bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 px-2.5 py-1 rounded font-bold transition"
                                        >
                                            Editar
                                        </button>
                                    </div>

                                    {/* Item 2: Preferências */}
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-800/60">
                                        <div>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold block">2. Idioma & Tema</span>
                                            <span className="text-gray-300">Idioma: <strong className="text-white">{configData?.language || language}</strong> | Tema: <strong className="text-white">{configData?.theme || theme}</strong></span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVisualWizardStep(1); setUserHasNavigated(true); }}
                                            className="text-[10px] bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 px-2.5 py-1 rounded font-bold transition"
                                        >
                                            Editar
                                        </button>
                                    </div>

                                    {/* Item 3: Banca */}
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-800/60">
                                        <div>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold block">3. Banca Inicial</span>
                                            <span className="text-emerald-400 font-bold">R$ {((startupStatus?.bankroll ?? Number(displayBankroll)) || 1000).toFixed(2)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVisualWizardStep(2); setUserHasNavigated(true); }}
                                            className="text-[10px] bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 px-2.5 py-1 rounded font-bold transition"
                                        >
                                            Editar
                                        </button>
                                    </div>

                                    {/* Item 4: Sync */}
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-800/60">
                                        <div>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold block">4. Sincronização de Giros</span>
                                            <span className={startupStatus?.stepsList?.[2]?.completed ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                                {startupStatus?.stepsList?.[2]?.completed ? '✓ Buffer de Giros OK (200+)' : 'Pendente'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVisualWizardStep(3); setUserHasNavigated(true); }}
                                            className="text-[10px] bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 px-2.5 py-1 rounded font-bold transition"
                                        >
                                            Editar
                                        </button>
                                    </div>

                                    {/* Item 5: Warmup */}
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold block">5. Aquecimento Quantitativo</span>
                                            <span className={startupStatus?.stepsList?.[3]?.completed ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                                {startupStatus?.stepsList?.[3]?.completed ? '✓ Motores Calibrados (Markov, Z-Score)' : 'Pendente'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVisualWizardStep(4); setUserHasNavigated(true); }}
                                            className="text-[10px] bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 px-2.5 py-1 rounded font-bold transition"
                                        >
                                            Editar
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setVisualWizardStep(4); setUserHasNavigated(true); }}
                                        className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition text-xs"
                                    >
                                        ◀ Voltar
                                    </button>
                                    <button
                                        onClick={handleWizardFinish}
                                        disabled={wizardLoading}
                                        className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                                    >
                                        <Play className="w-4 h-4 fill-white" />
                                        <span>ENTRAR NO OPERATIONAL HUD</span>
                                    </button>
                                </div>

                                {configMsg && <div className="text-rose-400 text-xs text-left bg-black p-2 border border-rose-900 rounded">{configMsg}</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!sessionState) {
        return (
            <div className="min-h-screen bg-black text-gray-200 p-4 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <Activity className="w-8 h-8 text-emerald-500 mb-4" />
                    <p className="font-mono text-sm text-gray-400">Loading Session...</p>
                </div>
            </div>
        );
    }

    if (sessionState.status === 'STOP_LOSS_TRIGGERED' || sessionState.status === 'STOP_WIN_TRIGGERED' || sessionState.status === 'FINISHED') {
        const lastAudit = history[history.length - 1];
        return (
            <div className="min-h-screen bg-black text-gray-200 p-4 flex items-center justify-center">
                <div className="w-full max-w-sm bg-gray-900 border border-gray-800 p-6 rounded-xl text-center space-y-4 font-mono">
                    <Activity className={`w-12 h-12 mx-auto ${sessionState.status === 'STOP_WIN_TRIGGERED' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <h1 className="text-2xl font-bold">SESSION FINISHED</h1>
                    <p className="text-gray-400 text-sm">{sessionState.status}</p>
                    
                    {lastAudit && (
                        <div className="text-left bg-black p-4 rounded border border-gray-800 text-sm space-y-2 mt-4">
                            <div className="flex justify-between"><span>Initial Bankroll:</span> <span>R$ {lastAudit.initialBankroll.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Final Bankroll:</span> <span className={lastAudit.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>R$ {lastAudit.finalBankroll.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>ROI:</span> <span className={lastAudit.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{(lastAudit.roi * 100).toFixed(2)}%</span></div>
                            <div className="flex justify-between"><span>Total Rounds:</span> <span>{lastAudit.totalRounds}</span></div>
                            <div className="flex justify-between"><span>Confirmed:</span> <span>{lastAudit.confirmedSuggestions}</span></div>
                            <div className="flex justify-between"><span>Skipped:</span> <span>{lastAudit.skippedSuggestions}</span></div>
                        </div>
                    )}
                    
                    <button onClick={() => setIsConfiguring(true)} className="w-full bg-gray-800 p-3 rounded mt-4 hover:bg-gray-700">
                        NEW SESSION
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col bg-[#0a0a0c] text-gray-200 overflow-hidden font-mono items-center">
            <div className="w-full max-w-lg flex flex-col h-full relative">
                
                {/* AREA DE CONTEÚDO SCROLLÁVEL */}
                <div className="flex-1 overflow-y-auto pb-20 px-2.5 py-3 flex flex-col gap-3 scrollbar-thin">

                    {/* ========================================== */}
                    {/* 1. ABA 'TERMINAL' (HUD PRINCIPAL TÁTICO) */}
                    {/* ========================================== */}
                    {activeTab === 'TERMINAL' && (
                        <>
                            {/* HEADER COMPACTO TÁTICO */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3 flex justify-between items-center shadow-lg">
                                <div>
                                    <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center gap-1">
                                        <Shield className="w-3 h-3 text-yellow-500" /> BANCA ATIVA
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-extrabold text-yellow-500 tracking-tight">
                                        R$ {(hudState?.data?.bankroll ?? 0).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                                        <span>GIRO: <strong className="text-white">{hudState?.data.currentRound ?? 0}</strong></span>
                                        <span className="text-gray-600">|</span>
                                        <span>MOTOR: <strong className="text-purple-400">{hudState?.data.engineRounds ?? (hudState?.data.currentRound ?? 0) + 214}</strong></span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 text-right">
                                    <div className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">RISCO & SAÚDE</div>
                                    <div className="flex gap-1.5 items-center">
                                        <div className="bg-black/80 px-2 py-0.5 rounded border border-amber-900/50 text-[10px] font-bold">
                                            <span className="text-gray-500">VIX: </span>
                                            <span className="text-amber-400">{hudState?.data.engineHealth?.vix ?? 12.5}</span>
                                        </div>
                                        <div className="bg-black/80 px-2 py-0.5 rounded border border-blue-900/50 text-[10px] font-bold">
                                            <span className="text-gray-500">ENT: </span>
                                            <span className="text-blue-400">{hudState?.data.engineHealth?.entropy ?? 0.89}</span>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        {hudState?.data.engineHealth?.marketRegime ?? 'TRENDING'}
                                    </div>
                                </div>
                            </div>

                            {/* BARRA DE STOP SUPER FINA */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-2.5 space-y-1.5 shadow">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-rose-400 flex items-center gap-1">
                                        <span>STOP LOSS:</span>
                                        <span className="text-white font-mono">
                                            R$ {(hudState?.data?.stopLossValue ?? ((hudState?.data?.bankroll ?? 1000) * 0.85)).toFixed(2)}
                                        </span>
                                    </span>
                                    <span className="text-emerald-400 flex items-center gap-1">
                                        <span>ALVO (STOP WIN):</span>
                                        <span className="text-white font-mono">
                                            R$ {(hudState?.data?.targetBankroll ?? ((hudState?.data?.bankroll ?? 1000) * 1.25)).toFixed(2)}
                                        </span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-rose-950">
                                        <div 
                                            className="bg-rose-500 h-1.5 rounded-full transition-all duration-300" 
                                            style={{ width: `${Math.min((hudState?.data.stopLossProgress || 0) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-emerald-950">
                                        <div 
                                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                                            style={{ width: `${Math.min((hudState?.data.stopWinProgress || 0) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* TIMELINE RECENTE */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-2.5 space-y-1.5 shadow">
                                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <History className="w-3 h-3 text-purple-400" /> TIMELINE RECENTE
                                    </span>
                                    <span className="text-[9px] text-gray-500 font-normal">← MAIS RECENTE | ROLÁVEL →</span>
                                </div>
                                <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-gray-800">
                                    {(hudState?.data.recentSpins && hudState.data.recentSpins.length > 0
                                        ? hudState.data.recentSpins
                                        : [17, 32, 0, 26, 3, 35, 12, 28, 7, 19, 15, 32, 0, 21, 4]
                                    ).map((num, idx) => {
                                        const isNewest = idx === 0;
                                        const isZero = num === 0;
                                        const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                                        const isRed = REDS.includes(num);
                                        const colorClass = isZero
                                            ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                                            : isRed
                                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                                            : 'bg-black text-gray-300 border-gray-800';
                                        const itemClass = isNewest
                                            ? `${colorClass} ring-2 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] border-purple-400 font-black relative scale-105 z-10`
                                            : colorClass;
                                        return (
                                            <div
                                                key={idx}
                                                className={`min-w-[32px] h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${itemClass}`}
                                                title={isNewest ? 'MAIS RECENTE' : `Giro ${idx}`}
                                            >
                                                {num}
                                                {isNewest && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* LOG / ANÁLISE QUANTITATIVA TÁTICA */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3 space-y-2 shadow text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest flex items-center justify-center gap-1">
                                    <Activity className="w-3 h-3 text-blue-400" /> ANÁLISE QUANTITATIVA EM TEMPO REAL
                                </div>
                                {hudState?.data.oracleMessage && (
                                    <div className="text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-900/50 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5">
                                        <span>{hudState.data.oracleMessage}</span>
                                    </div>
                                )}
                                {hudState?.data.strategySuggestion ? (
                                    <div className="space-y-1 pt-1">
                                        <div className="text-lg font-bold text-blue-400 uppercase tracking-wide">
                                            {hudState.data.strategySuggestion}
                                        </div>
                                        <div className="text-2xl font-extrabold text-white">
                                            R$ {(hudState.data.stakeValue ?? 0).toFixed(2)}
                                        </div>
                                        <div className="text-[11px] text-gray-400 font-medium">
                                            {hudState.data.selectedTarget && <span>Target: <strong className="text-purple-300">{hudState.data.selectedTarget}</strong> | </span>}
                                            Ficha Mínima: <strong className="text-white">R$ {(hudState.data.chipValue ?? 0).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 py-1 italic font-mono">
                                        Aguardando convergência tática / sinal do motor quantitativo...
                                    </div>
                                )}

                                {/* BLOCO VISUAL DECISION INTELLIGENCE (XAI) */}
                                <div className="mt-2 bg-[#0a0a0f] border border-blue-900/50 rounded-lg p-2.5 text-left space-y-1 shadow-inner">
                                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 border-b border-gray-800/80 pb-1">
                                        <Cpu className="w-3.5 h-3.5 text-blue-400" /> DECISION INTELLIGENCE (XAI)
                                    </div>
                                    <div className="text-[11px] text-gray-300 font-mono leading-relaxed pt-0.5">
                                        {hudState?.data.xaiExplanation ? (
                                            Array.isArray(hudState.data.xaiExplanation) ? (
                                                hudState.data.xaiExplanation.map((exp, i) => (
                                                    <div key={i} className="text-gray-300 flex items-start gap-1">
                                                        <span className="text-blue-400 font-bold">»</span>
                                                        <span>{exp}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-gray-300 flex items-start gap-1">
                                                    <span className="text-blue-400 font-bold">»</span>
                                                    <span>{hudState.data.xaiExplanation}</span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-gray-400 italic flex items-start gap-1">
                                                <span className="text-blue-500 font-bold">»</span>
                                                <span>Alvo selecionado devido à anomalia de Z-Score &gt; 2.1 no setor correspondente.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* TERMINAL DE FOGO OPERACIONAL */}
                            <div className="bg-[#121218] border border-purple-900/60 rounded-xl p-3 space-y-3 shadow-xl">
                                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center justify-between border-b border-gray-800 pb-1.5">
                                    <span className="flex items-center gap-1">
                                        <Flame className="w-3.5 h-3.5 text-purple-400" /> TERMINAL DE FOGO OPERACIONAL
                                    </span>
                                    <span className="text-[9px] text-gray-500">DIGITE O GIRO E CONFIRME</span>
                                </div>

                                <div className="flex gap-2 items-center justify-between">
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max="36" 
                                        placeholder="0-36"
                                        value={spinInput}
                                        onChange={(e) => setSpinInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleInjectSpin(); }}
                                        className="w-24 text-center text-xl font-bold bg-black border border-purple-800/80 rounded-xl py-2 px-2 text-white outline-none focus:border-purple-400 shadow-inner"
                                    />
                                    <button
                                        onClick={handleInjectSpin}
                                        disabled={spinLoading || !spinInput.trim()}
                                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow"
                                    >
                                        <Activity className="w-3.5 h-3.5" />
                                        <span>{spinLoading ? 'INJETANDO...' : 'INJETAR'}</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button 
                                        onClick={handleSkip}
                                        disabled={!hudState?.data.strategySuggestion}
                                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center transition text-xs active:scale-95 border border-gray-700"
                                    >
                                        <SkipForward className="w-4 h-4 mr-1.5 text-gray-400" /> PULAR
                                    </button>
                                    <button 
                                        onClick={handleConfirm}
                                        disabled={!hudState?.data.strategySuggestion}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center transition text-xs active:scale-95 shadow border border-emerald-500"
                                    >
                                        <Check className="w-4 h-4 mr-1.5" /> CONFIRMAR
                                    </button>
                                </div>
                            </div>

                            {/* TERMINAL OPERACIONAL RECOLHÍVEL */}
                            <div className={`bg-black border border-gray-800 rounded-xl p-3 font-mono text-xs flex flex-col transition-all duration-300 ${isTerminalExpanded ? 'h-64' : 'h-28'}`}>
                                <div className="flex items-center justify-between text-gray-500 border-b border-gray-800 pb-1.5 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Terminal className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-purple-400 font-bold text-[11px]">CONSOLE DE COMANDOS</span>
                                    </div>
                                    <button 
                                        onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-400 transition-colors"
                                    >
                                        {isTerminalExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-1 text-gray-300 font-mono text-[11px]">
                                    {cmdLog.length === 0 ? (
                                        <div className="text-gray-600 italic">Digite 'help' para listar comandos do terminal...</div>
                                    ) : (
                                        cmdLog.map((log, i) => (
                                            <div key={i} className="whitespace-pre-wrap">{log}</div>
                                        ))
                                    )}
                                </div>

                                {cmdInput.length > 0 && (
                                    <div className="flex flex-wrap gap-1 py-1 border-t border-gray-800/50 my-1">
                                        {availableCommands
                                            .filter(c => c.startsWith(cmdInput.toLowerCase().trim()))
                                            .map(sug => (
                                                <button
                                                    key={sug}
                                                    onClick={() => setCmdInput(sug)}
                                                    className="px-1.5 py-0.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-800 text-[10px] text-purple-300 rounded"
                                                >
                                                    {sug}
                                                </button>
                                            ))}
                                    </div>
                                )}

                                <div className="mt-1 flex items-center gap-2 pt-1 border-t border-gray-800">
                                    <span className="text-purple-500 font-bold">{'>'}</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 bg-transparent outline-none text-gray-200 placeholder-gray-600 font-mono text-[11px]"
                                        placeholder="Comando (sync, status, audit, help...)"
                                        value={cmdInput}
                                        onChange={e => setCmdInput(e.target.value)}
                                        onKeyDown={handleTerminalCommand}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========================================== */}
                    {/* 2. ABA 'WEIGHTS' (ALOCAÇÃO & PESOS RL) */}
                    {/* ========================================== */}
                    {activeTab === 'WEIGHTS' && (
                        <div className="flex flex-col gap-3">
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 text-center">
                                <div className="text-xs text-purple-400 font-bold mb-1 tracking-widest uppercase flex items-center justify-center gap-1.5">
                                    <TrendingUp className="w-4 h-4" /> PESOS E ALOCAÇÃO RL (Q-LEARNING)
                                </div>
                                <div className="text-xs text-gray-400">Distribuição Dinâmica de Capital por Estratégia</div>
                            </div>

                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-3">
                                <div className="text-xs text-purple-400 font-bold border-b border-gray-800 pb-2 flex items-center justify-between">
                                    <span>MATRIZ DE ESTRATÉGIAS & PESOS RL</span>
                                    <span className="text-[10px] text-emerald-400 font-normal">SISTEMA ATIVO</span>
                                </div>

                                <div className="space-y-2.5 text-xs">
                                    {((hudState?.data?.strategyWeights && hudState.data.strategyWeights.length > 0)
                                        ? hudState.data.strategyWeights
                                        : [
                                            { name: 'ZONE_TIERS', status: 'ON' as const, shadowPnl: 45.0, weight: 32 },
                                            { name: 'ZONE_VOISINS', status: 'ON' as const, shadowPnl: 28.0, weight: 25 },
                                            { name: 'ZONE_ORPHELINS', status: 'ON' as const, shadowPnl: 15.0, weight: 18 },
                                            { name: 'SECTOR_ZERO_GAME', status: 'ON' as const, shadowPnl: 12.0, weight: 12 },
                                            { name: 'SECTOR_POTINHO', status: 'ON' as const, shadowPnl: -5.0, weight: 8 },
                                            { name: 'CROSS_TERMINAL_7', status: 'OFF' as const, shadowPnl: 0.0, weight: 5 }
                                        ]
                                    ).map((item, idx) => (
                                        <div key={idx} className="bg-black p-3 rounded-xl border border-gray-800 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                                                        item.status === 'ON' 
                                                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800' 
                                                            : 'bg-rose-950 text-rose-400 border-rose-800'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                    <span className="font-bold text-white text-xs tracking-wide">{item.name}</span>
                                                </div>
                                                <span className={`font-bold text-xs ${item.shadowPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {item.shadowPnl >= 0 ? '+' : ''}R$ {item.shadowPnl.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                                                <span>Peso Consenso: <strong className="text-purple-300">{item.weight}%</strong></span>
                                                <span>Status: <strong className={item.status === 'ON' ? 'text-emerald-400' : 'text-gray-500'}>{item.status}</strong></span>
                                            </div>
                                            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${Math.min(item.weight, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================== */}
                    {/* 3. ABA 'STATS' (INTELIGÊNCIA & SAHPI) */}
                    {/* ========================================== */}
                    {activeTab === 'STATS' && (
                        <div className="flex flex-col gap-3">
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 text-center">
                                <div className="text-xs text-purple-400 font-bold mb-1 tracking-widest uppercase">AUDITORIA E DESEMPENHO HISTÓRICO</div>
                                <div className="text-xs text-gray-400">Visão Geral de Sessões e Análise de Campo</div>
                            </div>

                            {/* TERMÔMETRO DA MESA (HEATMAP) */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-3">
                                <div className="text-xs text-purple-400 font-bold border-b border-gray-800 pb-2 flex items-center justify-between">
                                    <span>TERMÔMETRO DA MESA (HEATMAP)</span>
                                    <Flame className="w-4 h-4 text-rose-400" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black p-2.5 rounded border border-rose-900/50 space-y-1.5">
                                        <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <Flame className="w-3 h-3 text-rose-500" /> QUENTES (ALTA FREQUÊNCIA)
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(hudState?.data.heatmap?.hotNumbers ?? [17, 32, 0, 26, 3]).map((num) => (
                                                <span key={num} className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-bold text-xs">
                                                    {num}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-black p-2.5 rounded border border-cyan-900/50 space-y-1.5">
                                        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <Snowflake className="w-3 h-3 text-cyan-400" /> FRIOS (ATRASADOS)
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(hudState?.data.heatmap?.coldNumbers ?? [1, 13, 24, 36, 10]).map((num) => (
                                                <span key={num} className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-bold text-xs">
                                                    {num}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* INTELIGÊNCIA OPERACIONAL */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-3">
                                <div className="text-xs text-purple-400 font-bold border-b border-gray-800 pb-2 flex items-center justify-between">
                                    <span>INTELIGÊNCIA OPERACIONAL</span>
                                    <Cpu className="w-4 h-4 text-purple-400" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black p-2 rounded border border-gray-800">
                                        <div className="text-gray-500 text-[10px]">Performance</div>
                                        <div className="font-bold text-emerald-400">{profile ? `${(profile.averageWinRate * 100).toFixed(0)}%` : '--'}</div>
                                    </div>
                                    <div className="bg-black p-2 rounded border border-gray-800">
                                        <div className="text-gray-500 text-[10px]">Consistência</div>
                                        <div className="font-bold text-blue-400">{profile ? profile.consistencyScore : '--'}</div>
                                    </div>
                                    <div className="bg-black p-2 rounded border border-gray-800">
                                        <div className="text-gray-500 text-[10px]">Tendência</div>
                                        <div className="font-bold text-purple-400">{profile ? (profile.trend === 'IMPROVING' ? 'Melhorando' : profile.trend === 'DECLINING' ? 'Declinando' : 'Estável') : '--'}</div>
                                    </div>
                                    <div className="bg-black p-2 rounded border border-gray-800">
                                        <div className="text-gray-500 text-[10px]">Risco</div>
                                        <div className="font-bold text-gray-200">{profile ? profile.riskLevel : '--'}</div>
                                    </div>
                                </div>
                                {latestInsight && (
                                    <div className="text-xs text-gray-300 bg-black p-2.5 rounded border border-gray-800">
                                        <span className="text-purple-400 font-bold">Insight: </span>
                                        {latestInsight}
                                    </div>
                                )}
                            </div>

                            {/* RELATÓRIOS DE AUDITORIA E EVOLUÇÃO */}
                            {(!performanceReport || (performanceReport.evolution.sessionCount ?? (performanceReport.evolution as any).totalSessions ?? 0) === 0) ? (
                                <div className="bg-[#121218] border border-purple-900/40 rounded-xl p-5 text-center space-y-2">
                                    <ShieldAlert className="w-8 h-8 text-purple-400 mx-auto opacity-80" />
                                    <div className="text-xs font-bold text-white tracking-wide">STATUS: COLETANDO DADOS DA SESSÃO</div>
                                    <div className="text-[11px] text-gray-400 max-w-sm mx-auto leading-relaxed">
                                        Sua sessão ativa está sendo monitorada pelo motor quantitativo. Os relatórios completos de evolução e auditoria serão consolidados após a finalização (<code className="text-purple-300">SESSION_FINISHED</code>).
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-4 space-y-3">
                                        <div className="text-xs text-gray-400 font-bold border-b border-gray-800 pb-2 flex items-center justify-between">
                                            <span>EVOLUÇÃO DE BANCA</span>
                                            <TrendingUp className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-black p-2.5 rounded border border-gray-800">
                                                <div className="text-gray-500 mb-1">Banca Inicial</div>
                                                <div className="font-bold text-base">R$ {performanceReport.evolution.startingBankroll.toFixed(2)}</div>
                                            </div>
                                            <div className="bg-black p-2.5 rounded border border-gray-800">
                                                <div className="text-gray-500 mb-1">Banca Atual</div>
                                                <div className="font-bold text-base text-purple-400">R$ {performanceReport.evolution.currentBankroll.toFixed(2)}</div>
                                            </div>
                                            <div className="bg-black p-2.5 rounded border border-gray-800">
                                                <div className="text-gray-500 mb-1">Pico / Máxima</div>
                                                <div className="font-bold text-emerald-400">R$ {performanceReport.evolution.highestBankroll.toFixed(2)}</div>
                                            </div>
                                            <div className="bg-black p-2.5 rounded border border-gray-800">
                                                <div className="text-gray-500 mb-1">Max Drawdown</div>
                                                <div className="font-bold text-rose-400">{(performanceReport.evolution.maxDrawdown * 100).toFixed(2)}%</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pt-1">
                                            <span className="text-gray-400">Taxa de Crescimento Geral:</span>
                                            <span className={`font-bold ${performanceReport.evolution.growthRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {(performanceReport.evolution.growthRate * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* REGISTROS IMUTÁVEIS DE AUDITORIA */}
                            <div className="bg-[#121218] border border-gray-800 rounded-xl p-4 space-y-3">
                                <div className="text-xs text-gray-400 font-bold border-b border-gray-800 pb-2 flex items-center justify-between">
                                    <span>REGISTROS IMUTÁVEIS DE AUDITORIA</span>
                                    <History className="w-4 h-4 text-purple-400" />
                                </div>
                                {auditHistory.length > 0 ? (
                                    <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                                        {auditHistory.slice().reverse().map((audit, i) => (
                                            <div key={i} className="bg-black p-2.5 rounded border border-gray-800 space-y-1">
                                                <div className="flex justify-between font-bold text-gray-300">
                                                    <span>{audit.data.sessionId}</span>
                                                    <span className={audit.data.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                        {audit.data.profitLoss >= 0 ? '+' : ''}R$ {audit.data.profitLoss.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-[10px] text-gray-500">
                                                    <span>ROI: {(audit.data.roi * 100).toFixed(1)}% | Score: {audit.data.performanceScore}</span>
                                                    <span>Motivo: {audit.data.stopReason}</span>
                                                </div>
                                                <div className="text-[9px] text-gray-600 truncate font-mono">
                                                    SHA-256: {audit.hash}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-500 text-center py-4">
                                        Nenhuma sessão finalizada para auditoria ainda.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========================================== */}
                    {/* 4. ABA 'CONFIG' (CONFIGURAÇÕES VISUAIS) */}
                    {/* ========================================== */}
                    {activeTab === 'CONFIG' && (
                        <div className="flex flex-col gap-3">
                            <div className="bg-[#121218] border border-purple-900/60 rounded-xl p-4 text-center space-y-1">
                                <div className="text-xs text-purple-400 font-bold tracking-widest uppercase flex items-center justify-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-purple-400" /> SPRINT-048 — OPERATIONAL CONFIGURATION ARCHITECTURE
                                </div>
                                <h2 className="text-base font-bold text-white uppercase">CONFIGURAÇÕES OPERACIONAIS INSTITUCIONAIS</h2>
                                <p className="text-[11px] text-gray-400">Gerenciamento centralizado imutável de preferências e parâmetros</p>
                            </div>

                            {configMsg && (
                                <div className={`p-3 rounded-xl border text-xs font-mono font-bold ${configMsg.startsWith('Erro') ? 'bg-rose-950/60 border-rose-800 text-rose-300' : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'}`}>
                                    {configMsg}
                                </div>
                            )}

                            {configData && (
                                <div className="space-y-3 text-xs">
                                    {/* Mesa */}
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                        <div className="font-bold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between items-center">
                                            <span>1. Configuração da Mesa</span>
                                            <span className="text-[10px] text-gray-500 font-normal">Provider & Ficha Mínima</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                disabled={configLoading}
                                                onClick={() => handleSaveConfig({ provider: 'PRAGMATIC' })}
                                                className={`p-2.5 rounded-lg border font-bold text-left transition ${configData.provider === 'PRAGMATIC' ? 'bg-purple-950 border-purple-500 text-purple-200' : 'bg-black border-gray-800 text-gray-400'}`}
                                            >
                                                <div>PRAGMATIC</div>
                                                <div className="text-[10px] text-gray-500 font-normal">Ficha: R$ 0,10</div>
                                            </button>
                                            <button
                                                disabled={configLoading}
                                                onClick={() => handleSaveConfig({ provider: 'EVOLUTION' })}
                                                className={`p-2.5 rounded-lg border font-bold text-left transition ${configData.provider === 'EVOLUTION' ? 'bg-purple-950 border-purple-500 text-purple-200' : 'bg-black border-gray-800 text-gray-400'}`}
                                            >
                                                <div>EVOLUTION</div>
                                                <div className="text-[10px] text-gray-500 font-normal">Ficha: R$ 0,50</div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Banca */}
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-3">
                                        <div className="font-bold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between items-center">
                                            <span>2. Banca Padrão</span>
                                            <span className="text-[10px] text-gray-500 font-normal">Campo Livre / Aporte Inicial</span>
                                        </div>
                                        
                                        <div className="flex gap-2 items-center bg-black p-2 rounded-lg border border-gray-800">
                                            <span className="text-xs text-gray-400 font-bold whitespace-nowrap">Valor Livre: R$</span>
                                            <input
                                                type="number"
                                                min="1"
                                                step="any"
                                                placeholder="1250"
                                                value={customBankrollInput !== '' ? customBankrollInput : (configData.defaultBankroll || '')}
                                                onChange={(e) => setCustomBankrollInput(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                                            />
                                            <button
                                                disabled={configLoading}
                                                onClick={() => {
                                                    const val = parseFloat(customBankrollInput);
                                                    if (isNaN(val) || val <= 0) {
                                                        setConfigMsg('Configuração inválida: Banca deve ser um valor positivo.');
                                                        return;
                                                    }
                                                    handleSaveConfig({ defaultBankroll: val });
                                                }}
                                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold text-xs transition whitespace-nowrap"
                                            >
                                                APLICAR
                                            </button>
                                        </div>
                                    </div>

                                    {/* HUD */}
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                        <div className="font-bold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between items-center">
                                            <span>3. HUD Operacional</span>
                                            <span className="text-[10px] text-gray-500 font-normal">Layout & Visual</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-black p-2.5 rounded-lg border border-gray-800">
                                            <span>Modo Compacto</span>
                                            <button
                                                disabled={configLoading}
                                                onClick={() => handleSaveConfig({ hudCompactMode: !configData.hudCompactMode })}
                                                className={`px-3 py-1 rounded font-bold text-xs ${configData.hudCompactMode ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                            >
                                                {configData.hudCompactMode ? 'ATIVO' : 'INATIVO'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Terminal */}
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                        <div className="font-bold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between items-center">
                                            <span>4. Terminal Quantitativo</span>
                                            <span className="text-[10px] text-gray-500 font-normal">Autocomplete & Histórico</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-black p-2.5 rounded-lg border border-gray-800">
                                            <span>Autocomplete de Comandos</span>
                                            <button
                                                disabled={configLoading}
                                                onClick={() => handleSaveConfig({ terminalAutocomplete: !configData.terminalAutocomplete })}
                                                className={`px-3 py-1 rounded font-bold text-xs ${configData.terminalAutocomplete ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                            >
                                                {configData.terminalAutocomplete ? 'ATIVO' : 'INATIVO'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Idioma & Tema */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                            <div className="font-bold text-purple-400 uppercase tracking-wider text-xs border-b border-gray-800 pb-1">
                                                5. Idioma
                                            </div>
                                            <select
                                                value={configData.language}
                                                disabled={configLoading}
                                                onChange={(e) => handleSaveConfig({ language: e.target.value as any })}
                                                className="w-full bg-black border border-gray-800 text-white text-xs p-2.5 rounded-lg outline-none focus:border-purple-500 cursor-pointer font-bold"
                                            >
                                                <option value="pt-BR" className="bg-gray-900 text-white">Português (pt-BR)</option>
                                                <option value="en-US" className="bg-gray-900 text-white">English (en-US)</option>
                                                <option value="es-ES" className="bg-gray-900 text-white">Español (es-ES)</option>
                                            </select>
                                        </div>

                                        <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                            <div className="font-bold text-purple-400 uppercase tracking-wider text-xs border-b border-gray-800 pb-1">
                                                6. Tema
                                            </div>
                                            <select
                                                value={configData.theme}
                                                disabled={configLoading}
                                                onChange={(e) => handleSaveConfig({ theme: e.target.value as any })}
                                                className="w-full bg-black border border-gray-800 text-white text-xs p-2.5 rounded-lg outline-none focus:border-purple-500 cursor-pointer font-bold"
                                            >
                                                <option value="DARK" className="bg-gray-900 text-white">Escuro (DARK)</option>
                                                <option value="LIGHT" className="bg-gray-900 text-white">Claro (LIGHT)</option>
                                                <option value="SYSTEM" className="bg-gray-900 text-white">Sistema (SYSTEM)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Sistema */}
                                    <div className="bg-[#121218] border border-gray-800 rounded-xl p-3.5 space-y-2">
                                        <div className="font-bold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between items-center">
                                            <span>7. Parâmetros de Automação do Sistema</span>
                                            <span className="text-[10px] text-gray-500 font-normal">Warmup & Sync</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex justify-between items-center bg-black p-2.5 rounded-lg border border-gray-800">
                                                <span>Warmup Auto</span>
                                                <button
                                                    disabled={configLoading}
                                                    onClick={() => handleSaveConfig({ autoWarmup: !configData.autoWarmup })}
                                                    className={`px-2.5 py-1 rounded font-bold text-xs ${configData.autoWarmup ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                                >
                                                    {configData.autoWarmup ? 'SIM' : 'NÃO'}
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center bg-black p-2.5 rounded-lg border border-gray-800">
                                                <span>Sync Auto</span>
                                                <button
                                                    disabled={configLoading}
                                                    onClick={() => handleSaveConfig({ autoSyncHistory: !configData.autoSyncHistory })}
                                                    className={`px-2.5 py-1 rounded font-bold text-xs ${configData.autoSyncHistory ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                                >
                                                    {configData.autoSyncHistory ? 'SIM' : 'NÃO'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hash / Auditoria */}
                                    <div className="bg-black border border-gray-800 rounded-xl p-3 font-mono text-[10px] text-gray-500 space-y-1">
                                        <div className="flex justify-between"><span>Versão do Snapshot:</span> <span className="text-gray-300 font-bold">{configData.version}</span></div>
                                        <div className="flex justify-between"><span>Criado em:</span> <span className="text-gray-300">{new Date(configData.createdAt).toLocaleTimeString()}</span></div>
                                        <div className="flex justify-between"><span>Atualizado em:</span> <span className="text-gray-300">{new Date(configData.updatedAt).toLocaleTimeString()}</span></div>
                                        <div className="truncate text-gray-400 pt-1 border-t border-gray-900">Hash SHA-256: {configData.hash}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* BOTTOM NAVIGATION BAR (FIXA NO RODAPÉ) */}
                <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#111116] border-t border-gray-800/80 flex justify-around items-center p-2 z-50 shadow-2xl backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('STATS')}
                        className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-lg transition-all text-[10px] font-bold ${
                            activeTab === 'STATS' ? 'bg-purple-900/60 text-purple-300 border border-purple-700/60 shadow-lg' : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        <span>STATS</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('WEIGHTS')}
                        className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-lg transition-all text-[10px] font-bold ${
                            activeTab === 'WEIGHTS' ? 'bg-purple-900/60 text-purple-300 border border-purple-700/60 shadow-lg' : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        <span>WEIGHTS</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('TERMINAL')}
                        className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-lg transition-all text-[10px] font-bold ${
                            activeTab === 'TERMINAL' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <Terminal className="w-4 h-4" />
                        <span>TERMINAL</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-lg transition-all text-[10px] font-bold ${
                            activeTab === 'CONFIG' ? 'bg-purple-900/60 text-purple-300 border border-purple-700/60 shadow-lg' : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <Cpu className="w-4 h-4" />
                        <span>CONFIG</span>
                    </button>
                </div>

            </div>
        </div>
    );
};
