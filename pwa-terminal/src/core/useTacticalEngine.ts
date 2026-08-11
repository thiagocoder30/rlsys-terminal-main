import { useState, useCallback, useEffect } from 'react';

const loadCache = <T>(key: string, fallback: T): T => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch { return fallback; }
};

const saveCache = (key: string, val: any) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
};

export function useTacticalEngine(initialBankroll = 55.00) {
    const [baseBankroll, setBaseBankroll] = useState<number>(() => loadCache('rl_base_bankroll', initialBankroll));
    const [bankroll, setBankroll] = useState<number>(() => loadCache('rl_bankroll', initialBankroll));
    const [peakBankroll, setPeakBankroll] = useState<number>(() => loadCache('rl_peak', initialBankroll));
    const [timeline, setTimeline] = useState<number[]>(() => loadCache('rl_timeline', []));
    const [provider, setProvider] = useState<'PRAGMATIC' | 'EVOLUTION'>(() => loadCache('rl_provider', 'PRAGMATIC'));
    const [disabledStrategies, setDisabledStrategies] = useState<string[]>(() => loadCache('rl_disabled_strats', []));
    const [sessionId, setSessionId] = useState<string | null>(null);

    const [shadowWeights, setShadowWeights] = useState<Record<string, number>>(() => loadCache('rl_weights', {}));
    const [shadowPnL, setShadowPnL] = useState<Record<string, number>>(() => loadCache('rl_pnl', {}));

    const [sessionWins] = useState<number>(() => loadCache('rl_wins', 0));
    const [sessionLosses] = useState<number>(() => loadCache('rl_losses', 0));
    const [actionLogs, setActionLogs] = useState<string[]>(() => loadCache('rl_logs', ['[SISTEMA] Motor Institucional Conectado.']));

    const [burnIn, setBurnIn] = useState<number>(() => loadCache('rl_burnin', 15));
    const [cooldown, setCooldown] = useState<number>(() => loadCache('rl_cooldown', 0));
    
    const [preFlightStatus, setPreFlightStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>(() => loadCache('rl_preflight_status', 'PENDING'));
    const [preFlightReason, setPreFlightReason] = useState<string>(() => loadCache('rl_preflight_reason', ''));
    
    const [vix, setVix] = useState(0.0);
    const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
    const [activeStake, setActiveStake] = useState<number>(0);
    const [activeDesc, setActiveDesc] = useState<string>("");
    const [auditReason, setAuditReason] = useState<string>(""); 
    const [oracleMessage, setOracleMessage] = useState<string>("Aguardando varredura tática..."); 
    const [isLocked, setIsLocked] = useState(false);
    const [lockReason, setLockReason] = useState("");
    const [shadowDecision] = useState<any>(null);

    const TAKE_PROFIT_PCT = 1.25; 
    const STOP_LOSS_PCT = 0.85; 
    const targetProfit = baseBankroll * TAKE_PROFIT_PCT;
    const stopLoss = baseBankroll * STOP_LOSS_PCT;

    useEffect(() => {
        setSessionId(crypto.randomUUID());
    }, [initialBankroll]);

    useEffect(() => { saveCache('rl_base_bankroll', baseBankroll); }, [baseBankroll]);
    useEffect(() => { saveCache('rl_bankroll', bankroll); }, [bankroll]);
    useEffect(() => { saveCache('rl_peak', peakBankroll); }, [peakBankroll]);
    useEffect(() => { saveCache('rl_timeline', timeline); }, [timeline]);
    useEffect(() => { saveCache('rl_provider', provider); }, [provider]);
    useEffect(() => { saveCache('rl_disabled_strats', disabledStrategies); }, [disabledStrategies]);
    useEffect(() => { saveCache('rl_weights', shadowWeights); }, [shadowWeights]);
    useEffect(() => { saveCache('rl_pnl', shadowPnL); }, [shadowPnL]);
    useEffect(() => { saveCache('rl_wins', sessionWins); }, [sessionWins]);
    useEffect(() => { saveCache('rl_losses', sessionLosses); }, [sessionLosses]);
    useEffect(() => { saveCache('rl_logs', actionLogs); }, [actionLogs]);
    useEffect(() => { saveCache('rl_burnin', burnIn); }, [burnIn]);
    useEffect(() => { saveCache('rl_cooldown', cooldown); }, [cooldown]);
    useEffect(() => { saveCache('rl_preflight_status', preFlightStatus); }, [preFlightStatus]);
    useEffect(() => { saveCache('rl_preflight_reason', preFlightReason); }, [preFlightReason]);

    const logAction = useCallback((msg: string) => {
        setActionLogs(prev => {
            const newLogs = [msg, ...prev];
            return newLogs.slice(0, 50);
        });
    }, []);

    const toggleStrategy = useCallback((stratName: string) => {
        setDisabledStrategies(prev => prev.includes(stratName) ? prev.filter(s => s !== stratName) : [...prev, stratName]);
        logAction(`[SYS] Estratégia ${stratName} ${disabledStrategies.includes(stratName) ? 'HABILITADA' : 'DESABILITADA'}.`);
    }, [disabledStrategies, logAction]);

    const applyIntelligenceResult = useCallback((data: any) => {
        setTimeline(data.newTimeline);
        setShadowWeights(data.shadowWeights);
        setShadowPnL(data.shadowPnL);
        setVix(data.vix);
        setPreFlightStatus(data.preFlightStatus);
        setPreFlightReason(data.preFlightReason);
        setIsLocked(data.isLocked);
        setLockReason(data.lockReason);
        setActiveStrategy(data.activeStrategy);
        setActiveStake(data.activeStake);
        setActiveDesc(data.activeStrategy ? `Sizing sugerido: R$ ${data.activeStake.toFixed(2)}` : "");
        setAuditReason(data.auditReason);
        setOracleMessage(data.oracleMessage);
        if (data.peakBankroll > peakBankroll) {
            setPeakBankroll(data.peakBankroll);
        }
    }, [peakBankroll]);

    const handleSpin = useCallback((drawnNumber: number, isRealPlay: boolean) => {
        if (!sessionId) return;
        
        const currentBankroll = bankroll;

        fetch(`/api/tactical/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                value: drawnNumber,
                bankroll: currentBankroll,
                provider,
                isSkip: !isRealPlay
            })
        })
        .then(res => res.json())
        .then(data => {
            applyIntelligenceResult(data);
            if (isRealPlay) {
                logAction(`[TRACK] Giro ${drawnNumber} processado no Runtime Institucional.`);
            } else {
                logAction(`[SKIP] Giro ${drawnNumber} observado.`);
            }
        })
        .catch(err => {
            console.error("[SYS] Erro ao comunicar com IntelligenceRuntime", err);
            logAction(`[ERRO CRÍTICO] Falha de comunicação com o IntelligenceRuntime.`);
        });

    }, [sessionId, bankroll, provider, logAction, applyIntelligenceResult]);

    const processSpin = useCallback((drawnNumber: number) => handleSpin(drawnNumber, true), [handleSpin]);
    const skipSpin = useCallback((drawnNumber: number) => handleSpin(drawnNumber, false), [handleSpin]);

    const syncTape = useCallback((nums: number[]) => {
        fetch(`/api/tactical/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeline: nums })
        })
        .then(res => res.json())
        .then(data => {
            applyIntelligenceResult(data);
            logAction(`[SYS] Fita Sincronizada com o IntelligenceRuntime.`);
        })
        .catch(_err => logAction(`[ERRO] Falha ao sincronizar a fita.`));
    }, [logAction, applyIntelligenceResult]);

    const setManualBankroll = (val: number) => {
        setBaseBankroll(val); setBankroll(val); setPeakBankroll(val); 
        setIsLocked(false); setLockReason("");
        setBurnIn(15); setCooldown(0); 
        setPreFlightStatus('PENDING'); setPreFlightReason('');
        logAction(`[SYS] Nova Base Finanças: R$ ${val.toFixed(2)}. Reator reiniciado.`);
    };

    const undoSpin = useCallback(() => {
        setTimeline(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
        logAction(`[UNDO] Último giro estornado no Client.`);
    }, [logAction]);

    return {
        bankroll, peakBankroll, vix, timeline, activeStrategy, activeStake, activeDesc, auditReason, oracleMessage,
        isLocked, lockReason, stopLoss, targetProfit, burnIn, cooldown, preFlightStatus, preFlightReason,
        shadowWeights, shadowPnL, sessionWins, sessionLosses, provider, setProvider, disabledStrategies, toggleStrategy,
        actionLogs, processSpin, skipSpin, undoSpin, syncTape, setManualBankroll, shadowDecision
    };
}
