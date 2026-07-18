#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 607"
echo " GOVERNANCE, SHADOW PNL & HAPTIC CORE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR/pwa-terminal"

# 1. Atualização do Motor Matemático (useTacticalEngine.ts) com Provedores e Filtros Dinâmicos
cat > src/core/useTacticalEngine.ts <<'EOF'
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

export function useTacticalEngine(initialBankroll = 171.00) {
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
    
    const [vix, setVix] = useState(0.0);
    const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
    const [activeStake, setActiveStake] = useState<number>(0);
    const [activeDesc, setActiveDesc] = useState<string>("");
    const [isLocked, setIsLocked] = useState(false);
    const [lockReason, setLockReason] = useState("");

    const STOP_LOSS_PCT = 0.85;
    const TAKE_PROFIT_TARGET = 180.00;

    // Ficha Mínima Dinâmica baseada no Provedor Alvo
    const minChip = provider === 'PRAGMATIC' ? 0.10 : 0.50;

    useEffect(() => {
        localStorage.setItem('rl_bankroll', JSON.stringify(bankroll));
        localStorage.setItem('rl_peak', JSON.stringify(peakBankroll));
        localStorage.setItem('rl_timeline', JSON.stringify(timeline));
        localStorage.setItem('rl_provider', JSON.stringify(provider));
        localStorage.setItem('rl_disabled_strats', JSON.stringify(disabledStrategies));
        localStorage.setItem('rl_weights', JSON.stringify(shadowWeights));
        localStorage.setItem('rl_pnl', JSON.stringify(shadowPnL));
        localStorage.setItem('rl_wins', JSON.stringify(sessionWins));
        localStorage.setItem('rl_losses', JSON.stringify(sessionLosses));
    }, [bankroll, peakBankroll, timeline, provider, disabledStrategies, shadowWeights, shadowPnL, sessionWins, sessionLosses]);

    useEffect(() => {
        const currentStopLoss = peakBankroll * STOP_LOSS_PCT;
        if (bankroll <= currentStopLoss) {
            setIsLocked(true); setLockReason("STOP LOSS ATINGIDO"); setActiveStrategy(null); return;
        }
        if (bankroll >= TAKE_PROFIT_TARGET) {
            setIsLocked(true); setLockReason("TAKE PROFIT ATINGIDO"); setActiveStrategy(null); return;
        }

        setIsLocked(false); setLockReason("");
        const currentVix = timeline.length > 5 ? Math.min(99.9, timeline.length * 2.1 + (Math.random() * 5)) : 0.0;
        setVix(currentVix);

        const requiredWeight = currentVix > 90 ? 1.30 : 1.05;
        let bestStrat = null; let highestWeight = 0;

        // Varredura filtrando as estratégias desligadas pelo operador
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
            
            const safeLimit = bankroll * 0.05;
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
    }, [timeline, bankroll, shadowWeights, peakBankroll, disabledStrategies, minChip]);

    const toggleStrategy = useCallback((stratId: string) => {
        setDisabledStrategies(prev => 
            prev.includes(stratId) ? prev.filter(s => s !== stratId) : [...prev, stratId]
        );
    }, []);

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
            if (pnl > 0) setSessionWins(w => w + 1); else setSessionLosses(l => l + 1);
            
            setBankroll(prev => {
                const newB = prev + pnl;
                if (newB > peakBankroll) setPeakBankroll(newB);
                return newB;
            });
        }
        updateShadowWeights(drawnNumber);
    }, [activeStrategy, activeStake, isLocked, peakBankroll]);

    const skipSpin = useCallback((drawnNumber: number) => {
        setTimeline(prev => {
            const next = [...prev, drawnNumber];
            return next.length > 15 ? next.slice(next.length - 15) : next;
        });
        updateShadowWeights(drawnNumber);
    }, []);

    const updateShadowWeights = (drawnNumber: number) => {
        setShadowWeights(prev => {
            const nextW = { ...prev };
            setShadowPnL(prevPnl => {
                const nextP = { ...prevPnl };
                for (const strat of Object.keys(STRATEGY_ZONES)) {
                    const isWin = STRATEGY_ZONES[strat].includes(drawnNumber);
                    // Contabilidade exata do Shadow PnL com base na ficha mínima ativa
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
    }, [minChip]);

    const setManualBankroll = (val: number) => {
        setBankroll(val); setPeakBankroll(val); setIsLocked(false); setLockReason("");
    };

    const undoSpin = useCallback(() => {
        setTimeline(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
    }, []);

    return {
        bankroll, peakBankroll, vix, timeline, activeStrategy, activeStake, activeDesc,
        isLocked, lockReason, stopLoss: peakBankroll * STOP_LOSS_PCT, targetProfit: TAKE_PROFIT_TARGET,
        shadowWeights, shadowPnL, sessionWins, sessionLosses, provider, setProvider, disabledStrategies, toggleStrategy,
        processSpin, skipSpin, undoSpin, syncTape, setManualBankroll
    };
}
EOF

# 2. Interface de Usuário Expandida (App.tsx) com Toggles, Shadow PnL e Haptic Feedback Nativos
cat > src/App.tsx <<'EOF'
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Target, Crosshair, History, Server, Undo2, BarChart2, Scale, TerminalSquare, Settings, Lock, X, FastForward, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTacticalEngine } from './core/useTacticalEngine';

export default function App() {
  const engine = useTacticalEngine(171.00);
  const [activeModal, setActiveModal] = useState<'STATS' | 'WEIGHTS' | 'TERMINAL' | 'CONFIG' | null>(null);
  const [termInput, setTermInput] = useState('');
  const [fastInput, setFastInput] = useState('');
  const [termLog, setTermLog] = useState<string[]>(['[SISTEMA] RL.SYS CLI Emulator Online.']);

  // Efeito Tático de Alta Frequência: Dispara Resposta Tátil (Vibrar) no celular ao acender Luz Verde
  useEffect(() => {
      if (engine.activeStrategy && !engine.isLocked) {
          if ('vibrate' in navigator) {
              navigator.vibrate([150, 50, 150]); // Padrão duplo seco militar
          }
      }
  }, [engine.activeStrategy, engine.isLocked]);

  const getNumberColor = (num: number) => {
    if (num === 0) return 'text-neon border-neon';
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return reds.includes(num) ? 'text-blood border-blood shadow-[0_0_5px_#FF003C40]' : 'text-gray-300 border-gray-600';
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termInput.trim().toLowerCase();
    setTermInput('');
    const logCmd = cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd;
    setTermLog(prev => [...prev, `> ${logCmd}`]);
    const isRawNumbers = /^[\d\s,]+$/.test(cmd) && cmd.includes(',');

    if (cmd.startsWith('sync ') || isRawNumbers) {
      const payload = cmd.startsWith('sync ') ? cmd.substring(5) : cmd;
      const strNums = payload.split(',');
      const nums = strNums.map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 36);
      if (nums.length > 0) {
        engine.syncTape(nums);
        setTermLog(prev => [...prev, `[OK] ${nums.length} giros sincronizados com sucesso.`]);
      } else { setTermLog(prev => [...prev, '[ERRO] Formato inválido.']); }
    } else if (cmd.startsWith('setbankroll ')) {
      const val = parseFloat(cmd.substring(12));
      if (!isNaN(val) && val >= 0) {
        engine.setManualBankroll(val);
        setTermLog(prev => [...prev, `[OK] Banca calibrada para R$ ${val.toFixed(2)}`]);
      }
    } else if (cmd === 'clear') {
      setTermLog([]);
    } else if (cmd === 'reset') {
      localStorage.clear();
      window.location.reload();
    } else { setTermLog(prev => [...prev, '[ERRO] Comando não reconhecido.']); }
  };

  const handleFastInput = (e: React.FormEvent) => {
      e.preventDefault();
      const val = fastInput.trim().toLowerCase();
      let isSkip = false; let numStr = val;
      
      if (val.startsWith('p') || val.startsWith('x')) {
          isSkip = true; numStr = val.substring(1);
      }
      
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 0 && num <= 36) {
          if (isSkip) engine.skipSpin(num); else engine.processSpin(num);
          setFastInput('');
      }
  };

  const displayTimeline = [...engine.timeline].reverse();

  return (
    <div className="h-[100dvh] w-full bg-obsidian flex flex-col overflow-hidden relative font-mono text-gray-300 select-none">
      
      {/* ZONA A: Global HUD */}
      <div className="flex-none bg-void border-b border-steel/30 p-4 z-20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-sans tracking-widest uppercase flex items-center gap-1">
              <Server size={12} className={engine.isLocked ? "text-blood" : "text-neon"} /> 
              {engine.isLocked ? "RL.SYS TRAVADO" : `RL.SYS ONLINE | ${engine.provider}`}
            </div>
            <div className="text-3xl font-bold text-yellow-500 mt-1">R$ {engine.bankroll.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-end gap-1 font-sans">
              <Activity size={12} className="text-blood" /> VIX ENTROPY
            </div>
            <div className="text-xl font-bold text-blood mt-1">{engine.vix.toFixed(1)}%</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-gray-400 font-sans">
            <span className="flex items-center gap-1"><ShieldAlert size={10} className="text-blood"/> STOP: R$ {engine.stopLoss.toFixed(2)}</span>
            <span className="flex items-center gap-1">ALVO: R$ {engine.targetProfit.toFixed(2)} <Target size={10} className="text-neon"/></span>
          </div>
          <div className="w-full h-1 bg-steel/20 rounded flex">
            <div className="h-full bg-neon transition-all duration-500 shadow-[0_0_10px_#00FF41]" style={{ width: `${Math.min(100, Math.max(0, ((engine.bankroll - engine.stopLoss) / (engine.targetProfit - engine.stopLoss)) * 100))}%` }}></div>
          </div>
        </div>
      </div>

      {/* ZONA B: Radar Térmico */}
      <div className="flex-none py-2 px-2 border-b border-steel/30 bg-void/50 z-20 shadow-sm relative">
        <div className="text-[10px] text-gray-500 mb-2 flex justify-between items-center px-2 font-sans uppercase">
          <span className="flex items-center gap-1 text-neon"><History size={10}/> ⭠ MAIS RECENTE</span>
          <span>ANTIGOS ⭢</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-2">
          {displayTimeline.length === 0 ? (
            <div className="text-xs text-gray-600 font-sans h-10 flex items-center">Aguardando fita histórica...</div>
          ) : (
            displayTimeline.map((num, idx) => (
              <div key={idx} className={`shrink-0 w-10 h-10 flex items-center justify-center rounded border bg-obsidian text-base font-bold relative ${getNumberColor(num)}`}>
                {idx === 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neon"></span>
                  </span>
                )}
                {num}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ZONA C: Painel de Combate */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-28 z-0">
        {engine.isLocked ? (
           <div className="bg-blood/10 border border-blood rounded-lg p-4 mb-4 flex flex-col items-center justify-center text-center">
             <Lock size={24} className="text-blood mb-2"/>
             <div className="text-sm font-bold text-blood uppercase">{engine.lockReason}</div>
           </div>
        ) : engine.activeStrategy ? (
            <div className="bg-steel/10 border border-neon/50 rounded-lg p-3 mb-4 shadow-[0_0_15px_rgba(0,255,65,0.1)] transition-all">
                <div className="text-xs text-neon mb-1 flex items-center gap-1 font-sans uppercase"><Crosshair size={12}/> Engage Autorizado</div>
                <div className="text-sm">Estratégia: <span className="font-bold text-white">{engine.activeStrategy}</span></div>
                <div className="text-sm">Stake Global: <span className="font-bold text-yellow-500">R$ {engine.activeStake.toFixed(2)}</span></div>
                <div className="text-xs text-neon font-bold mt-2 font-sans bg-obsidian border border-neon/30 p-2 rounded tracking-widest uppercase">{engine.activeDesc}</div>
            </div>
        ) : (
            <div className="bg-steel/10 border border-gray-600 rounded-lg p-3 mb-4 opacity-50">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 font-sans uppercase"><Activity size={12}/> Standby Mode</div>
                <div className="text-sm text-gray-400">Aguardando alinhamento térmico...</div>
            </div>
        )}

        {/* FAST INPUT BAR */}
        <form onSubmit={handleFastInput} className="flex gap-2 mb-4 bg-void p-2 rounded border border-steel/30">
            <div className="flex-1 flex items-center gap-2">
                <FastForward size={14} className="text-gray-500" />
                <input 
                    type="text" 
                    value={fastInput} 
                    onChange={e => setFastInput(e.target.value)} 
                    placeholder="Digitar: 15 ou p15" 
                    className="w-full bg-transparent border-none text-white text-sm focus:outline-none font-mono"
                    disabled={engine.isLocked}
                />
            </div>
            <button type="submit" disabled={engine.isLocked || !fastInput} className="bg-steel/30 text-white px-3 py-1 rounded text-[10px] uppercase font-bold active:bg-neon active:text-obsidian transition-colors disabled:opacity-50">
                Lançar
            </button>
        </form>

        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-gray-500 font-sans uppercase">Aposta Direta</span>
          <button onClick={engine.undoSpin} className="text-gray-400 bg-steel/20 px-4 py-2 rounded flex items-center gap-2 text-[10px] uppercase font-bold active:bg-steel/40 active:text-white transition-colors">
            <Undo2 size={12} /> Desfazer
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => engine.processSpin(0)} disabled={engine.isLocked} className="col-span-4 py-4 rounded bg-steel/20 border border-neon text-neon font-bold active:scale-95 text-lg disabled:opacity-30 disabled:bg-transparent">0 - GREEN</button>
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(num => (
            <button key={num} onClick={() => engine.processSpin(num)} disabled={engine.isLocked} className={`py-4 rounded border font-bold active:scale-90 transition-all ${getNumberColor(num)} bg-steel/10 text-lg shadow-sm disabled:opacity-30 disabled:border-gray-800 disabled:bg-transparent`}>{num}</button>
          ))}
        </div>
      </div>

      {/* ZONA D: Command Center */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-void border-t border-steel/30 flex justify-around items-center z-50 px-2 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        <button onClick={() => setActiveModal('STATS')} className={`flex flex-col items-center gap-1 p-2 ${activeModal === 'STATS' ? 'text-neon' : 'text-gray-400'}`}><BarChart2 size={22} /><span className="text-[9px] font-sans uppercase">Stats</span></button>
        <button onClick={() => setActiveModal('WEIGHTS')} className={`flex flex-col items-center gap-1 p-2 ${activeModal === 'WEIGHTS' ? 'text-neon' : 'text-gray-400'}`}><Scale size={22} /><span className="text-[9px] font-sans uppercase">Weights</span></button>
        <button onClick={() => setActiveModal('TERMINAL')} className={`flex flex-col items-center gap-1 p-2 ${activeModal === 'TERMINAL' ? 'text-neon' : 'text-gray-400'}`}><TerminalSquare size={26} /><span className="text-[10px] font-sans uppercase font-bold text-shadow">Terminal</span></button>
        <button onClick={() => setActiveModal('CONFIG')} className={`flex flex-col items-center gap-1 p-2 ${activeModal === 'CONFIG' ? 'text-neon' : 'text-gray-400'}`}><Settings size={22} /><span className="text-[9px] font-sans uppercase">Config</span></button>
      </div>

      {/* MODALS OVERLAYS */}
      {activeModal && (
        <div className="absolute inset-0 bg-obsidian/95 z-40 flex flex-col pb-16">
          <div className="p-4 border-b border-steel/30 flex justify-between items-center bg-void">
            <h2 className="text-neon font-bold flex items-center gap-2"><TerminalSquare size={18}/> {activeModal}</h2>
            <button onClick={() => setActiveModal(null)} className="text-gray-400 p-2"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {activeModal === 'TERMINAL' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4 text-xs space-y-1">
                  {termLog.map((log, i) => <div key={i} className={log.startsWith('[ERRO]') ? 'text-blood' : log.startsWith('[OK]') ? 'text-neon' : 'text-gray-400'}>{log}</div>)}
                </div>
                <form onSubmit={handleTerminalSubmit} className="flex gap-2 shrink-0">
                  <input type="text" value={termInput} onChange={e => setTermInput(e.target.value)} placeholder="Cole a fita aqui..." className="flex-1 bg-steel/20 border border-steel/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon text-white font-mono" />
                  <button type="submit" className="bg-neon text-obsidian px-4 py-2 rounded font-bold uppercase text-xs">Run</button>
                </form>
              </div>
            )}

            {activeModal === 'WEIGHTS' && (
              <div className="space-y-2 text-xs">
                <div className="text-[10px] text-gray-500 uppercase pb-2 border-b border-steel/20 flex justify-between">
                    <span>Estratégia [Reator]</span>
                    <span>PnL Base | Peso RL</span>
                </div>
                {Object.entries(engine.shadowWeights).sort((a,b) => b[1] - a[1]).map(([strat, w]) => {
                  const isDisable = engine.disabledStrategies.includes(strat);
                  const pnlValue = engine.shadowPnL[strat] || 0;
                  return (
                    <div key={strat} className={`flex justify-between items-center border-b border-steel/10 py-3 ${isDisable ? 'opacity-30' : ''}`}>
                      <div className="flex items-center gap-2">
                        {/* Chave de Controle de Malha ON/OFF */}
                        <button 
                            onClick={() => engine.toggleStrategy(strat)}
                            className={`px-2 py-1 rounded text-[9px] uppercase font-bold border transition-colors ${isDisable ? 'border-blood/40 text-blood bg-blood/10' : 'border-neon/40 text-neon bg-neon/10'}`}
                        >
                            {isDisable ? 'OFF' : 'ON'}
                        </button>
                        <span className={`font-bold ${isDisable ? 'text-gray-600 line-through' : w >= 2.0 ? 'text-white' : 'text-gray-400'}`}>
                           {strat.replace('CROSS_', '').replace('SECTOR_', '').replace('ZONE_', '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className={pnlValue >= 0 ? 'text-neon' : 'text-blood'}>
                            {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)}
                        </span>
                        <span className="font-bold text-gray-300 w-8 text-right">{w.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeModal === 'STATS' && (
              <div className="space-y-4 text-sm">
                <div className="bg-steel/10 p-4 rounded border border-steel/30">
                  <div className="text-gray-400 mb-1 font-sans text-xs">Win Rate Efetivo</div>
                  <div className="text-2xl text-neon font-bold">{engine.sessionWins + engine.sessionLosses > 0 ? ((engine.sessionWins / (engine.sessionWins + engine.sessionLosses)) * 100).toFixed(1) : '0.0'}%</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-steel/10 p-3 rounded"><div className="text-[10px] text-gray-500 uppercase">Wins</div><div className="text-lg text-neon">{engine.sessionWins}</div></div>
                  <div className="bg-steel/10 p-3 rounded"><div className="text-[10px] text-gray-500 uppercase">Losses</div><div className="text-lg text-blood">{engine.sessionLosses}</div></div>
                </div>
              </div>
            )}

            {activeModal === 'CONFIG' && (
              <div className="text-sm text-gray-400 space-y-6">
                <div>
                    <label className="text-xs uppercase text-gray-500 font-sans tracking-widest block mb-2">Provedor Ativo (Ficha Mínima)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => engine.setProvider('PRAGMATIC')}
                            className={`py-3 rounded font-bold uppercase text-xs border transition-all ${engine.provider === 'PRAGMATIC' ? 'bg-neon text-obsidian border-neon' : 'bg-steel/10 text-gray-400 border-steel/30'}`}
                        >
                            Pragmatic (R$ 0,10)
                        </button>
                        <button 
                            onClick={() => engine.setProvider('EVOLUTION')}
                            className={`py-3 rounded font-bold uppercase text-xs border transition-all ${engine.provider === 'EVOLUTION' ? 'bg-neon text-obsidian border-neon' : 'bg-steel/10 text-gray-400 border-steel/30'}`}
                        >
                            Evolution (R$ 0,50)
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-gray-500 font-sans tracking-widest">Comandos Administrativos via Terminal:</p>
                  <div className="bg-steel/10 p-3 rounded font-mono text-xs text-white">setbankroll [valor]</div>
                  <div className="bg-steel/10 p-3 rounded font-mono text-xs text-white">clear</div>
                  <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="w-full bg-blood/10 border border-blood text-blood py-3 rounded uppercase font-bold text-xs mt-4 active:bg-blood active:text-white transition-colors"
                  >
                      reset global de sessão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
EOF

echo "[RL.SYS] Compilação Concluída. Arquitetura de Governança Integrada."
echo "======================================"
