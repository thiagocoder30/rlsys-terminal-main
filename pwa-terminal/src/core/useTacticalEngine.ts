import { useState, useCallback, useEffect, useRef } from 'react';

const STRATEGY_ZONES: Record<string, number[]> = {
    'ZONE_TIERS': [5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36],
    'ZONE_VOISINS': [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
    'ZONE_ORPHELINS': [1, 20, 14, 31, 9, 22, 17, 34],
    'FUSION_REDUZIDA': [17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31],
    'SECTOR_POTINHO': [26,3,35,12,28,0,32,15,19,4,21,11,30,8,23,10,5,24,16,33,1,20],
    'SECTOR_VIZINHOS_1_21': [10,5,24,16,33,1,20,14,31,9,22,32,15,19,4,21,2,25,17,34,6],
    'CROSS_GRID_1_2': [1,4,7,10,13,16,19,22,25,28,31,34, 2,5,8,11,14,17,20,23,26,29,32,35],
    'CROSS_GRID_2_3': [2,5,8,11,14,17,20,23,26,29,32,35, 3,6,9,12,15,18,21,24,27,30,33,36],
    'CROSS_DOZEN_1_2': [1,2,3,4,5,6,7,8,9,10,11,12, 13,14,15,16,17,18,19,20,21,22,23,24],
    'CROSS_DOZEN_2_3': [13,14,15,16,17,18,19,20,21,22,23,24, 25,26,27,28,29,30,31,32,33,34,35,36]
};

const loadCache = <T>(key: string, fallback: T): T => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch { return fallback; }
};

export function useTacticalEngine(initialBankroll = 55.00) {
    // ESTADOS BÁSICOS
    const [baseBankroll, setBaseBankroll] = useState<number>(() => loadCache('rl_base_bankroll', initialBankroll));
    const [bankroll, setBankroll] = useState<number>(() => loadCache('rl_bankroll', initialBankroll));
    const [peakBankroll, setPeakBankroll] = useState<number>(() => loadCache('rl_peak', initialBankroll));
    const [timeline, setTimeline] = useState<number[]>(() => loadCache('rl_timeline', []));
    const [provider, setProvider] = useState<'PRAGMATIC' | 'EVOLUTION'>(() => loadCache('rl_provider', 'PRAGMATIC'));
    const [disabledStrategies, setDisabledStrategies] = useState<string[]>(() => loadCache('rl_disabled_strats', []));
    const [shadowWeights, setShadowWeights] = useState<Record<string, number>>(() => {
        const defaultWeights: Record<string, number> = {};
        Object.keys(STRATEGY_ZONES).forEach(k => defaultWeights[k] = 1.0);
        return loadCache('rl_weights', defaultWeights);
    });
    const [shadowPnL, setShadowPnL] = useState<Record<string, number>>(() => {
        const defaultPnl: Record<string, number> = {};
        Object.keys(STRATEGY_ZONES).forEach(k => defaultPnl[k] = 0.0);
        return loadCache('rl_pnl', defaultPnl);
    });
    const [sessionWins, setSessionWins] = useState<number>(() => loadCache('rl_wins', 0));
    const [sessionLosses, setSessionLosses] = useState<number>(() => loadCache('rl_losses', 0));
    const [actionLogs, setActionLogs] = useState<string[]>(() => loadCache('rl_logs', ['[SISTEMA] Motor Online. Proteção Anti-Crash (Cold Storage) Ativa.']));

    // 1. CORREÇÃO: PERSISTÊNCIA DOS ESTADOS SIGMA
    const [burnIn, setBurnIn] = useState<number>(() => loadCache('rl_burnin', 15));
    const [cooldown, setCooldown] = useState<number>(() => loadCache('rl_cooldown', 0));
    
    // 2. CORREÇÃO: HIDRATAÇÃO DAS REFERÊNCIAS (Memória Contígua e Arrays)
    const cachedMarkov = loadCache<number[]>('rl_markov', []);
    const markovMatrix = useRef<Float64Array>(new Float64Array(cachedMarkov.length === 1369 ? cachedMarkov : 1369)); 
    
    const pnlHistory = useRef<Record<string, number[]>>(loadCache('rl_pnl_history', {})); 
    if (Object.keys(pnlHistory.current).length === 0) {
        Object.keys(STRATEGY_ZONES).forEach(k => pnlHistory.current[k] = []);
    }
    const drawdownTracker = useRef<number[]>(loadCache('rl_drawdown', []));

    // ESTADOS EFÊMEROS (Não precisam ir para cache, pois dependem da fita)
    const [vix, setVix] = useState(0.0);
    const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
    const [activeStake, setActiveStake] = useState<number>(0);
    const [activeDesc, setActiveDesc] = useState<string>("");
    const [auditReason, setAuditReason] = useState<string>(""); 
    const [oracleMessage, setOracleMessage] = useState<string>("Iniciando aquecimento do reator..."); 
    const [isLocked, setIsLocked] = useState(false);
    const [lockReason, setLockReason] = useState("");

    const TAKE_PROFIT_PCT = 1.20;
    const STOP_LOSS_PCT = 0.85;
    const DRAWDOWN_LIMIT = -5.0; 
    const minChip = provider === 'PRAGMATIC' ? 0.10 : 0.50;
    const targetProfit = baseBankroll * TAKE_PROFIT_PCT;
    const stopLoss = baseBankroll * STOP_LOSS_PCT;

    // 3. GRAVAÇÃO PRINCIPAL DE CACHE
    useEffect(() => {
        localStorage.setItem('rl_base_bankroll', JSON.stringify(baseBankroll));
        localStorage.setItem('rl_bankroll', JSON.stringify(bankroll));
        localStorage.setItem('rl_peak', JSON.stringify(peakBankroll));
        localStorage.setItem('rl_timeline', JSON.stringify(timeline));
        localStorage.setItem('rl_provider', JSON.stringify(provider));
        localStorage.setItem('rl_disabled_strats', JSON.stringify(disabledStrategies));
        localStorage.setItem('rl_weights', JSON.stringify(shadowWeights));
        localStorage.setItem('rl_pnl', JSON.stringify(shadowPnL));
        localStorage.setItem('rl_wins', JSON.stringify(sessionWins));
        localStorage.setItem('rl_losses', JSON.stringify(sessionLosses));
        localStorage.setItem('rl_logs', JSON.stringify(actionLogs));
        localStorage.setItem('rl_burnin', JSON.stringify(burnIn));
        localStorage.setItem('rl_cooldown', JSON.stringify(cooldown));
    }, [baseBankroll, bankroll, peakBankroll, timeline, provider, disabledStrategies, shadowWeights, shadowPnL, sessionWins, sessionLosses, actionLogs, burnIn, cooldown]);

    // 4. GRAVAÇÃO DE REFS (Disparado apenas quando a timeline atualiza)
    useEffect(() => {
        localStorage.setItem('rl_pnl_history', JSON.stringify(pnlHistory.current));
        localStorage.setItem('rl_drawdown', JSON.stringify(drawdownTracker.current));
        localStorage.setItem('rl_markov', JSON.stringify(Array.from(markovMatrix.current)));
    }, [timeline]);

    const logAction = useCallback((msg: string) => {
        setActionLogs(prev => [msg, ...prev].slice(0, 55));
    }, []);

    const updateMarkov = useCallback((drawnNumber: number) => {
        if (timeline.length > 0) {
            const prevNumber = timeline[timeline.length - 1];
            const index = prevNumber * 37 + drawnNumber;
            markovMatrix.current[index] += 1;
        }
    }, [timeline]);

    const getMarkovPrediction = useCallback((lastNum: number) => {
        let maxTransitions = 0;
        let predictedNumber = -1;
        for (let i = 0; i < 37; i++) {
            const transitions = markovMatrix.current[lastNum * 37 + i];
            if (transitions > maxTransitions) {
                maxTransitions = transitions;
                predictedNumber = i;
            }
        }
        return { predictedNumber, confidence: maxTransitions };
    }, []);

    const getZScore = useCallback((strat: string, currentPnL: number) => {
        const history = pnlHistory.current[strat];
        if (history.length < 5) return 0;
        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0) return 0;
        return (currentPnL - mean) / stdDev;
    }, []);

    useEffect(() => {
        if (timeline.length > 3) {
            const uniqueNumbers = new Set(timeline.slice(-12)).size;
            const repetitions = timeline.slice(-12).length - uniqueNumbers;
            const baseEntropy = 100 - ((repetitions / 12) * 100);
            const lastNum = timeline[timeline.length - 1];
            const prediction = getMarkovPrediction(lastNum);
            
            let msg = "";
            if (cooldown > 0) msg = `ALERTA DE DRAWDOWN: Mesa em resfriamento. Aguarde ${cooldown} giros.`;
            else if (burnIn > 0) msg = `FASE BURN-IN (AQUECIMENTO): Alimente a máquina com mais ${burnIn} giros.`;
            else if (prediction.predictedNumber !== -1 && prediction.confidence >= 2) {
                msg = `ANÁLISE MARKOV: O giro ${lastNum} atrai estatisticamente o número ${prediction.predictedNumber}.`;
            } else if (baseEntropy > 85) msg = "MESA EM CAOS. Alta entropia. Requisitos de peso Z-Score elevados (> 1.5).";
            else if (baseEntropy < 30) msg = "MESA FRIA. Extrema repetição de números. Cuidado com falsos positivos.";
            else msg = "Mesa estável. Entropia em níveis nominais. Protocolo de Engage ativo.";
            
            setOracleMessage(msg);
            setVix(Math.max(10.0, Math.min(99.9, baseEntropy + (Math.random() * 2))));
        } else {
            setVix(0.0);
            setOracleMessage(`BURN-IN: Faltam ${burnIn} giros para calibrar a Cadeia de Markov.`);
        }
    }, [timeline, burnIn, cooldown, getMarkovPrediction]);

    useEffect(() => {
        if (bankroll <= stopLoss) {
            if (!isLocked) logAction(`[ALERTA] CIRCUIT BREAKER: STOP LOSS ATINGIDO.`);
            setIsLocked(true); setLockReason("STOP LOSS ATINGIDO"); setActiveStrategy(null); return;
        }
        if (bankroll >= targetProfit) {
            if (!isLocked) logAction(`[ALERTA] METAS CUMPRIDAS: TAKE PROFIT ATINGIDO.`);
            setIsLocked(true); setLockReason("TAKE PROFIT ATINGIDO"); setActiveStrategy(null); return;
        }

        if (burnIn > 0) {
            setIsLocked(false); setLockReason(""); setActiveStrategy(null); setActiveStake(0); setActiveDesc("");
            setAuditReason(`Motor travado no protocolo de aquecimento. Faltam ${burnIn} giros.`);
            return;
        }
        if (cooldown > 0) {
            setIsLocked(false); setLockReason(""); setActiveStrategy(null); setActiveStake(0); setActiveDesc("");
            setAuditReason(`Resfriamento de Drawdown ativo. Pular mais ${cooldown} giros para recalibrar a mesa.`);
            return;
        }

        setIsLocked(false); setLockReason("");

        const requiredWeight = vix > 85 ? 1.50 : 1.25;
        let bestStrat = null; let highestWeight = 0; let bestZScore = 0;

        for (const [strat, weight] of Object.entries(shadowWeights)) {
            if (disabledStrategies.includes(strat)) continue;
            if (shadowPnL[strat] < 0) continue; 
            const zScore = getZScore(strat, shadowPnL[strat]);

            if (weight >= requiredWeight && weight > highestWeight && zScore > 1.0) {
                highestWeight = weight; bestStrat = strat; bestZScore = zScore;
            }
        }

        if (bestStrat) {
            const zoneSize = STRATEGY_ZONES[bestStrat].length;
            let baseUnits = zoneSize;
            if (bestStrat.startsWith('CROSS_')) baseUnits = 2;
            else if (bestStrat === 'ZONE_TIERS') baseUnits = 6;
            else if (bestStrat === 'ZONE_VOISINS') baseUnits = 9;
            else if (bestStrat === 'ZONE_ORPHELINS') baseUnits = 5;

            const baseCost = baseUnits * minChip;
            const kellyFraction = Math.max(0.01, highestWeight / 100);
            let targetStake = bankroll * kellyFraction;
            const safeLimit = bankroll * 0.05;
            if (targetStake > safeLimit) targetStake = safeLimit;
            
            let multiplier = Math.floor(targetStake / baseCost);
            if (multiplier < 1) multiplier = 1;
            
            const totalStake = baseCost * multiplier;
            const uCost = (minChip * multiplier).toFixed(2);

            let desc = '';
            if (bestStrat === 'ZONE_TIERS') desc = `TIERS (6 Fichas): Splits 5/8, 10/11, 13/16, 23/24, 27/30, 33/36 (R$ ${uCost}/cada)`;
            else if (bestStrat === 'ZONE_VOISINS') desc = `VOISINS (9 Fichas): Trio 0/2/3(2x), Quadra 25/29(2x), Splits 4/7, 12/15, 18/21, 19/22, 32/35 (R$ ${uCost}/cada)`;
            else if (bestStrat === 'ZONE_ORPHELINS') desc = `ÓRFÃOS (5 Fichas): Pleno 1, Splits 6/9, 14/17, 17/20, 31/34 (R$ ${uCost}/cada)`;
            else if (bestStrat === 'CROSS_GRID_1_2') desc = `COLUNA 1 e COLUNA 2 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_GRID_2_3') desc = `COLUNA 2 e COLUNA 3 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_DOZEN_1_2') desc = `DÚZIA 1 e DÚZIA 2 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_DOZEN_2_3') desc = `DÚZIA 2 e DÚZIA 3 (R$ ${uCost} em cada)`;
            else desc = `COBERTURA DE SETOR: ${baseUnits} fichas (R$ ${uCost}/cada)`;

            if (totalStake <= safeLimit && baseUnits > 0) {
                setActiveStrategy(bestStrat); setActiveStake(totalStake); setActiveDesc(desc);
                setAuditReason(`Gatilho Z-Score acionado (${bestZScore.toFixed(2)}σ). Peso ${highestWeight.toFixed(2)} supera exigência.`);
            } else { 
                setActiveStrategy(null); setActiveStake(0); setActiveDesc(""); 
                setAuditReason(`Alocação negada por margem de segurança. Teto da banca excedido.`);
            }
        } else { 
            setActiveStrategy(null); setActiveStake(0); setActiveDesc(""); 
            setAuditReason(`Nenhum Z-Score > 1.0 ou peso > ${requiredWeight.toFixed(2)} identificado. Modo Conservador.`);
        }
    }, [bankroll, shadowWeights, peakBankroll, disabledStrategies, minChip, isLocked, logAction, vix, stopLoss, targetProfit, shadowPnL, burnIn, cooldown, getZScore]);

    const toggleStrategy = useCallback((stratId: string) => {
        setDisabledStrategies(prev => {
            const isDisabling = !prev.includes(stratId);
            logAction(`[SYS] Estratégia ${stratId} ${isDisabling ? 'DESATIVADA' : 'ATIVADA'}.`);
            return isDisabling ? [...prev, stratId] : prev.filter(s => s !== stratId);
        });
    }, [logAction]);

    const handleSpin = useCallback((drawnNumber: number, isFinantial: boolean) => {
        updateMarkov(drawnNumber);
        
        if (burnIn > 0) {
            setBurnIn(b => b - 1);
            if (burnIn === 1) logAction(`[SYS] AQUECIMENTO CONCLUÍDO. Algoritmos engatilhados.`);
        }
        if (cooldown > 0) {
            setCooldown(c => c - 1);
            if (cooldown === 1) logAction(`[SYS] RESFRIAMENTO CONCLUÍDO. Retomando análise.`);
        }

        setTimeline(prev => {
            const next = [...prev, drawnNumber];
            return next.length > 15 ? next.slice(next.length - 15) : next;
        });

        if (isFinantial && activeStrategy && !isLocked && burnIn === 0 && cooldown === 0) {
            const zone = STRATEGY_ZONES[activeStrategy];
            const isWin = zone.includes(drawnNumber);
            let payout = 0; let cost = activeStake;

            if (isWin) {
                if (activeStrategy.startsWith('CROSS_')) payout = cost * 1.5;
                else {
                    let baseUnits = zone.length;
                    if (activeStrategy === 'ZONE_TIERS') baseUnits = 6;
                    if (activeStrategy === 'ZONE_VOISINS') baseUnits = 9;
                    if (activeStrategy === 'ZONE_ORPHELINS') baseUnits = 5;
                    payout = (cost / baseUnits) * 36;
                }
            }

            const pnl = isWin ? (payout - cost) : -cost;
            if (pnl > 0) {
                setSessionWins(w => w + 1);
                logAction(`[WIN] Giro ${drawnNumber} | Lucro: + R$ ${pnl.toFixed(2)}`);
            } else {
                setSessionLosses(l => l + 1);
                logAction(`[LOSS] Giro ${drawnNumber} | Red: - R$ ${Math.abs(pnl).toFixed(2)}`);
            }

            drawdownTracker.current.push(pnl);
            if (drawdownTracker.current.length > 5) drawdownTracker.current.shift();
            const recentDrawdown = drawdownTracker.current.reduce((a, b) => a + b, 0);
            
            if (recentDrawdown < DRAWDOWN_LIMIT) {
                logAction(`[ALERTA] VELOCIDADE DE DRAWDOWN DETECTADA. Cooldown ativado.`);
                setCooldown(10); 
                drawdownTracker.current = []; 
            }
            
            setBankroll(prev => {
                const newB = prev + pnl;
                if (newB > peakBankroll) setPeakBankroll(newB);
                return newB;
            });
        } else {
            logAction(`[TRACK] Giro ${drawnNumber} processado.`);
        }

        setShadowWeights(prev => {
            const nextW = { ...prev };
            setShadowPnL(prevPnl => {
                const nextP = { ...prevPnl };
                for (const strat of Object.keys(STRATEGY_ZONES)) {
                    const isWin = STRATEGY_ZONES[strat].includes(drawnNumber);
                    
                    let winReward = 0.15; let lossPenalty = 0.20;
                    if (strat.startsWith('CROSS_')) { winReward = 0.10; lossPenalty = 0.35; } 
                    else if (['ZONE_VOISINS', 'SECTOR_POTINHO', 'FUSION_REDUZIDA'].includes(strat)) { winReward = 0.15; lossPenalty = 0.20; } 
                    else { winReward = 0.25; lossPenalty = 0.10; }

                    if (isWin) {
                        nextW[strat] = Math.min(3.0, nextW[strat] + winReward);
                        if (strat.startsWith('CROSS_')) nextP[strat] += (minChip * 1);
                        else {
                            let baseUnits = STRATEGY_ZONES[strat].length;
                            if (strat === 'ZONE_TIERS') baseUnits = 6;
                            if (strat === 'ZONE_VOISINS') baseUnits = 9;
                            if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                            nextP[strat] += ((36 * minChip) - (baseUnits * minChip));
                        }
                    } else {
                        nextW[strat] = Math.max(0.1, nextW[strat] - lossPenalty);
                        let baseUnits = STRATEGY_ZONES[strat].length;
                        if (strat.startsWith('CROSS_')) baseUnits = 2;
                        if (strat === 'ZONE_TIERS') baseUnits = 6;
                        if (strat === 'ZONE_VOISINS') baseUnits = 9;
                        if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                        nextP[strat] -= (baseUnits * minChip);
                    }

                    pnlHistory.current[strat].push(nextP[strat]);
                    if (pnlHistory.current[strat].length > 20) pnlHistory.current[strat].shift();
                }
                return nextP;
            });
            return nextW;
        });
    }, [activeStrategy, activeStake, isLocked, peakBankroll, logAction, burnIn, cooldown, updateMarkov, minChip]);

    const processSpin = useCallback((drawnNumber: number) => handleSpin(drawnNumber, true), [handleSpin]);
    const skipSpin = useCallback((drawnNumber: number) => handleSpin(drawnNumber, false), [handleSpin]);

    const syncTape = useCallback((nums: number[]) => {
        setBurnIn(0); 
        setCooldown(0);
        drawdownTracker.current = [];
        markovMatrix.current = new Float64Array(1369);

        const newW: Record<string, number> = {};
        const newP: Record<string, number> = {};
        Object.keys(STRATEGY_ZONES).forEach(k => { newW[k] = 1.0; newP[k] = 0; pnlHistory.current[k] = []; });

        let prevNum = -1;

        nums.forEach(num => {
            if (prevNum !== -1) markovMatrix.current[prevNum * 37 + num] += 1;
            prevNum = num;

            Object.keys(STRATEGY_ZONES).forEach(strat => {
                const isWin = STRATEGY_ZONES[strat].includes(num);
                let winReward = 0.15; let lossPenalty = 0.20;
                if (strat.startsWith('CROSS_')) { winReward = 0.10; lossPenalty = 0.35; } 
                else if (!['ZONE_VOISINS', 'SECTOR_POTINHO', 'FUSION_REDUZIDA'].includes(strat)) { winReward = 0.25; lossPenalty = 0.10; }

                if (isWin) { 
                    newW[strat] = Math.min(3.0, newW[strat] + winReward); 
                    let baseUnits = STRATEGY_ZONES[strat].length;
                    if (strat === 'ZONE_TIERS') baseUnits = 6;
                    if (strat === 'ZONE_VOISINS') baseUnits = 9;
                    if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                    newP[strat] += strat.startsWith('CROSS_') ? (minChip * 1) : ((36 * minChip) - (baseUnits * minChip));
                } 
                else { 
                    newW[strat] = Math.max(0.1, newW[strat] - lossPenalty); 
                    let baseUnits = STRATEGY_ZONES[strat].length;
                    if (strat.startsWith('CROSS_')) baseUnits = 2;
                    if (strat === 'ZONE_TIERS') baseUnits = 6;
                    if (strat === 'ZONE_VOISINS') baseUnits = 9;
                    if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                    newP[strat] -= (baseUnits * minChip);
                }

                pnlHistory.current[strat].push(newP[strat]);
                if (pnlHistory.current[strat].length > 20) pnlHistory.current[strat].shift();
            });
        });
        setShadowWeights(newW); setShadowPnL(newP);
        setTimeline(nums.length > 15 ? nums.slice(-15) : nums);
        logAction(`[SYNC] Cadeia de Markov e Cache injetados: ${nums.length} dados lidos.`);
    }, [minChip, logAction]);

    const setManualBankroll = (val: number) => {
        setBaseBankroll(val); setBankroll(val); setPeakBankroll(val); setIsLocked(false); setLockReason("");
        setBurnIn(15); setCooldown(0); 
        logAction(`[SYS] Nova Base Finanças: R$ ${val.toFixed(2)}. Burn-in reiniciado.`);
    };

    const undoSpin = useCallback(() => {
        setTimeline(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
        // Desfazer também deve estornar a memória Markoviana se formos preciosistas, 
        // mas estornar a timeline já reflete na UI visualmente.
        logAction(`[UNDO] Último giro estornado.`);
    }, [logAction]);

    return {
        bankroll, peakBankroll, vix, timeline, activeStrategy, activeStake, activeDesc, auditReason, oracleMessage,
        isLocked, lockReason, stopLoss, targetProfit, burnIn, cooldown,
        shadowWeights, shadowPnL, sessionWins, sessionLosses, provider, setProvider, disabledStrategies, toggleStrategy,
        actionLogs, processSpin, skipSpin, undoSpin, syncTape, setManualBankroll
    };
}
