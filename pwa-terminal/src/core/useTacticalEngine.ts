import { useState, useCallback, useEffect } from 'react';

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
    const [actionLogs, setActionLogs] = useState<string[]>(() => loadCache('rl_logs', ['[SISTEMA] Blindagem Nível Titânio Ativa.']));

    const [vix, setVix] = useState(0.0);
    const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
    const [activeStake, setActiveStake] = useState<number>(0);
    const [activeDesc, setActiveDesc] = useState<string>("");
    const [isLocked, setIsLocked] = useState(false);
    const [lockReason, setLockReason] = useState("");

    const TAKE_PROFIT_PCT = 1.20;
    const STOP_LOSS_PCT = 0.85;
    const minChip = provider === 'PRAGMATIC' ? 0.10 : 0.50;

    const targetProfit = baseBankroll * TAKE_PROFIT_PCT;
    const stopLoss = baseBankroll * STOP_LOSS_PCT;

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
    }, [baseBankroll, bankroll, peakBankroll, timeline, provider, disabledStrategies, shadowWeights, shadowPnL, sessionWins, sessionLosses, actionLogs]);

    const logAction = useCallback((msg: string) => {
        setActionLogs(prev => [msg, ...prev].slice(0, 55));
    }, []);

    useEffect(() => {
        if (bankroll <= stopLoss) {
            if (!isLocked) logAction(`[ALERTA] CIRCUIT BREAKER: STOP LOSS ATINGIDO (R$ ${stopLoss.toFixed(2)}).`);
            setIsLocked(true); setLockReason("STOP LOSS ATINGIDO"); setActiveStrategy(null); return;
        }
        if (bankroll >= targetProfit) {
            if (!isLocked) logAction(`[ALERTA] METAS CUMPRIDAS: TAKE PROFIT ATINGIDO (R$ ${targetProfit.toFixed(2)}).`);
            setIsLocked(true); setLockReason("TAKE PROFIT ATINGIDO"); setActiveStrategy(null); return;
        }

        setIsLocked(false); setLockReason("");

        if (timeline.length > 3) {
            const uniqueNumbers = new Set(timeline.slice(-12)).size;
            const repetitions = timeline.slice(-12).length - uniqueNumbers;
            const baseEntropy = 100 - ((repetitions / 12) * 100);
            setVix(Math.max(10.0, Math.min(99.9, baseEntropy + (Math.random() * 4))));
        } else {
            setVix(0.0);
        }

        // ====== BARREIRA TITÂNIO DE PROTEÇÃO DE CAPITAL ======
        // Rigor matemático restaurado igual à versão CLI. 
        // VIX alto (Caos) exige peso massivo (1.50). VIX baixo (Estável) exige peso prudente (1.25).
        const requiredWeight = vix > 85 ? 1.50 : 1.25;
        // ======================================================

        let bestStrat = null; let highestWeight = 0;

        for (const [strat, weight] of Object.entries(shadowWeights)) {
            if (disabledStrategies.includes(strat)) continue;
            if (weight >= requiredWeight && weight > highestWeight) {
                highestWeight = weight; bestStrat = strat;
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
            
            const safeLimit = bankroll * 0.05; // Teto de segurança irredutível: Max 5% da banca
            if (targetStake > safeLimit) targetStake = safeLimit;
            
            let multiplier = Math.floor(targetStake / baseCost);
            if (multiplier < 1) multiplier = 1;
            
            const totalStake = baseCost * multiplier;
            const uCost = (minChip * multiplier).toFixed(2);

            let desc = '';
            if (bestStrat === 'ZONE_TIERS') desc = `6 Splits no Tiers (R$ ${uCost}/cada)`;
            else if (bestStrat === 'ZONE_VOISINS') desc = `Vizinhos do Zero (R$ ${uCost}/ficha. Total 9)`;
            else if (bestStrat === 'ZONE_ORPHELINS') desc = `Números Órfãos (R$ ${uCost}/ficha. Total 5)`;
            else if (bestStrat === 'CROSS_GRID_1_2') desc = `COLUNA 1 e COLUNA 2 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_GRID_2_3') desc = `COLUNA 2 e COLUNA 3 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_DOZEN_1_2') desc = `DÚZIA 1 e DÚZIA 2 (R$ ${uCost} em cada)`;
            else if (bestStrat === 'CROSS_DOZEN_2_3') desc = `DÚZIA 2 e DÚZIA 3 (R$ ${uCost} em cada)`;
            else desc = `Cobertura Plena: ${baseUnits} fichas (R$ ${uCost}/cada)`;

            if (totalStake <= safeLimit && baseUnits > 0) {
                setActiveStrategy(bestStrat); setActiveStake(totalStake); setActiveDesc(desc);
            } else { setActiveStrategy(null); setActiveStake(0); setActiveDesc(""); }
        } else { setActiveStrategy(null); setActiveStake(0); setActiveDesc(""); }
    }, [timeline, bankroll, shadowWeights, peakBankroll, disabledStrategies, minChip, isLocked, logAction, vix, stopLoss, targetProfit]);

    const toggleStrategy = useCallback((stratId: string) => {
        setDisabledStrategies(prev => {
            const isDisabling = !prev.includes(stratId);
            logAction(`[SYS] Estratégia ${stratId} ${isDisabling ? 'DESATIVADA' : 'ATIVADA'}.`);
            return isDisabling ? [...prev, stratId] : prev.filter(s => s !== stratId);
        });
    }, [logAction]);

    const processSpin = useCallback((drawnNumber: number) => {
        setTimeline(prev => {
            const next = [...prev, drawnNumber];
            return next.length > 15 ? next.slice(next.length - 15) : next;
        });

        if (activeStrategy && !isLocked) {
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
            
            setBankroll(prev => {
                const newB = prev + pnl;
                if (newB > peakBankroll) setPeakBankroll(newB);
                return newB;
            });
        } else {
            logAction(`[TRACK] Giro ${drawnNumber} mapeado fora de combate.`);
        }
        updateShadowWeights(drawnNumber);
    }, [activeStrategy, activeStake, isLocked, peakBankroll, logAction]);

    const skipSpin = useCallback((drawnNumber: number) => {
        setTimeline(prev => {
            const next = [...prev, drawnNumber];
            return next.length > 15 ? next.slice(next.length - 15) : next;
        });
        logAction(`[SKIP] Giro ${drawnNumber} ignorado. Pesos atualizados.`);
        updateShadowWeights(drawnNumber);
    }, [logAction]);

    const updateShadowWeights = (drawnNumber: number) => {
        setShadowWeights(prev => {
            const nextW = { ...prev };
            setShadowPnL(prevPnl => {
                const nextP = { ...prevPnl };
                for (const strat of Object.keys(STRATEGY_ZONES)) {
                    const isWin = STRATEGY_ZONES[strat].includes(drawnNumber);
                    if (isWin) {
                        nextW[strat] = Math.min(3.0, nextW[strat] + 0.15);
                        if (strat.startsWith('CROSS_')) nextP[strat] += (minChip * 1);
                        else {
                            let baseUnits = STRATEGY_ZONES[strat].length;
                            if (strat === 'ZONE_TIERS') baseUnits = 6;
                            if (strat === 'ZONE_VOISINS') baseUnits = 9;
                            if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                            nextP[strat] += ((36 * minChip) - (baseUnits * minChip));
                        }
                    } else {
                        nextW[strat] = Math.max(0.1, nextW[strat] - 0.20);
                        let baseUnits = STRATEGY_ZONES[strat].length;
                        if (strat.startsWith('CROSS_')) baseUnits = 2;
                        if (strat === 'ZONE_TIERS') baseUnits = 6;
                        if (strat === 'ZONE_VOISINS') baseUnits = 9;
                        if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                        nextP[strat] -= (baseUnits * minChip);
                    }
                }
                return nextP;
            });
            return nextW;
        });
    };

    const syncTape = useCallback((nums: number[]) => {
        const newW: Record<string, number> = {};
        const newP: Record<string, number> = {};
        Object.keys(STRATEGY_ZONES).forEach(k => { newW[k] = 1.0; newP[k] = 0; });

        nums.forEach(num => {
            Object.keys(STRATEGY_ZONES).forEach(strat => {
                const isWin = STRATEGY_ZONES[strat].includes(num);
                if (isWin) { 
                    newW[strat] = Math.min(3.0, newW[strat] + 0.15); 
                    let baseUnits = STRATEGY_ZONES[strat].length;
                    if (strat === 'ZONE_TIERS') baseUnits = 6;
                    if (strat === 'ZONE_VOISINS') baseUnits = 9;
                    if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                    newP[strat] += strat.startsWith('CROSS_') ? (minChip * 1) : ((36 * minChip) - (baseUnits * minChip));
                } 
                else { 
                    newW[strat] = Math.max(0.1, newW[strat] - 0.20); 
                    let baseUnits = STRATEGY_ZONES[strat].length;
                    if (strat.startsWith('CROSS_')) baseUnits = 2;
                    if (strat === 'ZONE_TIERS') baseUnits = 6;
                    if (strat === 'ZONE_VOISINS') baseUnits = 9;
                    if (strat === 'ZONE_ORPHELINS') baseUnits = 5;
                    newP[strat] -= (baseUnits * minChip);
                }
            });
        });
        setShadowWeights(newW); setShadowPnL(newP);
        setTimeline(nums.length > 15 ? nums.slice(-15) : nums);
        logAction(`[SYNC] Fita Sincronizada: ${nums.length} giros processados.`);
    }, [minChip, logAction]);

    const setManualBankroll = (val: number) => {
        setBaseBankroll(val);
        setBankroll(val);
        setPeakBankroll(val);
        setIsLocked(false);
        setLockReason("");
        logAction(`[SYS] Nova Base Finanças: R$ ${val.toFixed(2)}. Metas Realinhadas.`);
    };

    const undoSpin = useCallback(() => {
        setTimeline(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
        logAction(`[UNDO] Último giro estornado do radar térmico.`);
    }, [logAction]);

    return {
        bankroll, peakBankroll, vix, timeline, activeStrategy, activeStake, activeDesc,
        isLocked, lockReason, stopLoss, targetProfit,
        shadowWeights, shadowPnL, sessionWins, sessionLosses, provider, setProvider, disabledStrategies, toggleStrategy,
        actionLogs, processSpin, skipSpin, undoSpin, syncTape, setManualBankroll
    };
}
