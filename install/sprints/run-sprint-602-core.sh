#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 602"
echo " THE CORE FUSION (ENGINE INTEGRATION)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR/pwa-terminal"

mkdir -p src/core

# 1. O Cérebro Matemático (useTacticalEngine.ts)
cat > src/core/useTacticalEngine.ts <<'EOF'
import { useState, useCallback, useEffect } from 'react';

// Dicionário de Zonas Táticas
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

export function useTacticalEngine(initialBankroll = 171.00) {
    // Estados do Motor
    const [bankroll, setBankroll] = useState(initialBankroll);
    const [peakBankroll, setPeakBankroll] = useState(initialBankroll);
    const [timeline, setTimeline] = useState<number[]>([]);
    
    // Shadow Trading
    const [shadowWeights, setShadowWeights] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        Object.keys(STRATEGY_ZONES).forEach(k => initial[k] = 1.0);
        return initial;
    });
    
    // Alvos e Qualificação Atual
    const [vix, setVix] = useState(0.0);
    const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
    const [activeStake, setActiveStake] = useState<number>(0);
    const [activeCoverage, setActiveCoverage] = useState<number>(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockReason, setLockReason] = useState("");

    const MIN_CHIP = 0.10; // Pragmatic config
    const STOP_LOSS_PCT = 0.85;
    const TAKE_PROFIT_TARGET = 180.00;

    // Recalcula o próximo movimento sempre que a timeline muda
    useEffect(() => {
        const currentStopLoss = peakBankroll * STOP_LOSS_PCT;
        
        // 1. Checagem de Sobrevivência (Circuit Breaker)
        if (bankroll <= currentStopLoss) {
            setIsLocked(true);
            setLockReason("STOP LOSS ATINGIDO");
            setActiveStrategy(null);
            return;
        }
        if (bankroll >= TAKE_PROFIT_TARGET) {
            setIsLocked(true);
            setLockReason("TAKE PROFIT ATINGIDO");
            setActiveStrategy(null);
            return;
        }

        setIsLocked(false);
        setLockReason("");

        // 2. Calcula VIX Baseado na Temperatura
        const currentVix = timeline.length > 5 ? Math.min(99.9, timeline.length * 2.1 + (Math.random() * 5)) : 0.0;
        setVix(currentVix);

        // 3. Escolhe a Melhor Estratégia
        const requiredWeight = currentVix > 90 ? 1.30 : 1.05;
        let bestStrat = null;
        let highestWeight = 0;

        for (const [strat, weight] of Object.entries(shadowWeights)) {
            if (weight >= requiredWeight && weight > highestWeight) {
                highestWeight = weight;
                bestStrat = strat;
            }
        }

        if (bestStrat) {
            const zoneSize = STRATEGY_ZONES[bestStrat].length;
            let baseUnits = zoneSize;
            
            // Regras de precificação para Zonas Especiais
            if (bestStrat.startsWith('CROSS_')) baseUnits = 2; // Apostas em Dúzias/Colunas gastam 2 fichas base
            else if (bestStrat === 'ZONE_TIERS') baseUnits = 6;
            else if (bestStrat === 'ZONE_VOISINS') baseUnits = 9;
            else if (bestStrat === 'ZONE_ORPHELINS') baseUnits = 5;

            const baseCost = baseUnits * MIN_CHIP;
            const kellyFraction = Math.max(0.01, highestWeight / 100);
            let targetStake = bankroll * kellyFraction;
            
            // Limite de Segurança (Max 5% da banca)
            const safeLimit = bankroll * 0.05;
            if (targetStake > safeLimit) targetStake = safeLimit;
            
            let multiplier = Math.floor(targetStake / baseCost);
            if (multiplier < 1) multiplier = 1;
            
            const totalStake = baseCost * multiplier;

            if (totalStake <= safeLimit) {
                setActiveStrategy(bestStrat);
                setActiveStake(totalStake);
                setActiveCoverage(baseUnits * multiplier); // Total de fichas espalhadas
            } else {
                setActiveStrategy(null);
            }
        } else {
            setActiveStrategy(null);
            setActiveStake(0);
        }

    }, [timeline, bankroll, shadowWeights, peakBankroll]);

    // Dispara a Ordem e Lê o Resultado
    const processSpin = useCallback((drawnNumber: number) => {
        setTimeline(prev => {
            const next = [...prev, drawnNumber];
            return next.length > 15 ? next.slice(next.length - 15) : next;
        });

        // Resolve PnL da Aposta Ativa
        if (activeStrategy && !isLocked) {
            const zone = STRATEGY_ZONES[activeStrategy];
            const isWin = zone.includes(drawnNumber);
            let payout = 0;
            let cost = activeStake;

            if (isWin) {
                // Matemática de Pagamento Simplificada
                if (activeStrategy.startsWith('CROSS_')) payout = cost * 1.5; // Ex: Aposta 2, Paga 3 (Lucro 1)
                else payout = (cost / activeCoverage) * 36; // Plenos pagam 36x a ficha base
            }

            const pnl = isWin ? (payout - cost) : -cost;
            
            setBankroll(prev => {
                const newB = prev + pnl;
                if (newB > peakBankroll) setPeakBankroll(newB);
                return newB;
            });
        }

        // Atualiza o Shadow Trading (Motor RL)
        setShadowWeights(prev => {
            const nextWeights = { ...prev };
            for (const strat of Object.keys(STRATEGY_ZONES)) {
                const isWin = STRATEGY_ZONES[strat].includes(drawnNumber);
                if (isWin) {
                    nextWeights[strat] = Math.min(3.0, nextWeights[strat] + 0.15);
                } else {
                    nextWeights[strat] = Math.max(0.1, nextWeights[strat] - 0.20);
                }
            }
            return nextWeights;
        });
    }, [activeStrategy, activeStake, activeCoverage, isLocked, peakBankroll]);

    const undoSpin = useCallback(() => {
        setTimeline(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
        // O PnL não é desfeito nesta versão V1 do front-end por segurança matemática
    }, []);

    return {
        bankroll,
        peakBankroll,
        vix,
        timeline,
        activeStrategy,
        activeStake,
        activeCoverage,
        isLocked,
        lockReason,
        stopLoss: peakBankroll * STOP_LOSS_PCT,
        targetProfit: TAKE_PROFIT_TARGET,
        processSpin,
        undoSpin
    };
}
EOF

# 2. Conectando a Interface ao Motor (App.tsx)
cat > src/App.tsx <<'EOF'
import React, { useEffect, useRef } from 'react';
import { 
  ShieldAlert, Activity, Target, Crosshair, History, Server, 
  Undo2, BarChart2, Scale, TerminalSquare, Settings, Lock
} from 'lucide-react';
import { useTacticalEngine } from './core/useTacticalEngine';

export default function App() {
  const engine = useTacticalEngine(171.00); // Banca inicial
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [engine.timeline]);

  const getNumberColor = (num: number) => {
    if (num === 0) return 'text-neon border-neon';
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return reds.includes(num) ? 'text-blood border-blood shadow-[0_0_5px_#FF003C40]' : 'text-gray-300 border-gray-600';
  };

  return (
    <div className="h-[100dvh] w-full bg-obsidian flex flex-col overflow-hidden relative font-mono text-gray-300 select-none">
      
      {/* ZONA A: Global HUD */}
      <div className="flex-none bg-void border-b border-steel/30 p-4 z-20 shadow-md">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-sans tracking-widest uppercase flex items-center gap-1">
              <Server size={12} className={engine.isLocked ? "text-blood" : "text-neon"} /> 
              {engine.isLocked ? "RL.SYS TRAVADO" : "RL.SYS ONLINE"}
            </div>
            <div className="text-3xl font-bold text-yellow-500 mt-1">
              R$ {engine.bankroll.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-end gap-1 font-sans tracking-widest">
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
          <div className="w-full h-1 bg-steel/20 rounded overflow-hidden flex">
            {/* Calculo visual de progresso */}
            <div 
                className="h-full bg-neon transition-all duration-500 shadow-[0_0_10px_#00FF41]"
                style={{ width: `${Math.min(100, Math.max(0, ((engine.bankroll - engine.stopLoss) / (engine.targetProfit - engine.stopLoss)) * 100))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ZONA B: Radar Térmico */}
      <div className="flex-none py-2 px-2 border-b border-steel/30 bg-void/50 z-20 shadow-sm">
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1 px-2 font-sans uppercase">
          <History size={10}/> Timeline Recente
        </div>
        <div ref={timelineRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-2 scroll-smooth">
          {engine.timeline.length === 0 ? (
            <div className="text-xs text-gray-600 font-sans h-10 flex items-center">Aguardando inserção de dados na matriz...</div>
          ) : (
            engine.timeline.map((num, idx) => (
              <div key={idx} className={`shrink-0 w-10 h-10 flex items-center justify-center rounded border bg-obsidian text-base font-bold ${getNumberColor(num)}`}>
                {num}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ZONA C: Painel de Combate */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-28 z-0 relative">
        
        {/* Painel Tático Dinâmico */}
        {engine.isLocked ? (
           <div className="bg-blood/10 border border-blood rounded-lg p-4 mb-4 flex flex-col items-center justify-center text-center">
             <Lock size={24} className="text-blood mb-2"/>
             <div className="text-sm font-bold text-blood uppercase tracking-widest">{engine.lockReason}</div>
             <div className="text-xs text-gray-400 mt-1 font-sans">Sistema HFT suspenso por quebra de gatilho financeiro.</div>
           </div>
        ) : engine.activeStrategy ? (
            <div className="bg-steel/10 border border-neon/50 rounded-lg p-3 mb-4 shadow-[0_0_15px_rgba(0,255,65,0.1)] transition-all">
                <div className="text-xs text-neon mb-1 flex items-center gap-1 font-sans uppercase">
                    <Crosshair size={12}/> Engage Autorizado
                </div>
                <div className="text-sm">Estratégia: <span className="font-bold text-white">{engine.activeStrategy}</span></div>
                <div className="text-sm">Stake Global: <span className="font-bold text-yellow-500">R$ {engine.activeStake.toFixed(2)}</span></div>
                <div className="text-[10px] text-gray-400 mt-2 font-sans">Cobertura de Segurança: {engine.activeCoverage} fichas em jogo.</div>
            </div>
        ) : (
            <div className="bg-steel/10 border border-gray-600 rounded-lg p-3 mb-4 opacity-50">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 font-sans uppercase">
                    <Activity size={12}/> Standby Mode
                </div>
                <div className="text-sm text-gray-400">Aguardando alinhamento térmico do motor Shadow Trading...</div>
            </div>
        )}

        {/* Numpad Tático */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-gray-500 font-sans uppercase tracking-widest">Input Tático</span>
          <button onClick={engine.undoSpin} className="text-gray-400 bg-steel/20 px-4 py-2 rounded flex items-center gap-2 text-[10px] uppercase font-bold active:bg-steel/40 active:text-white transition-colors">
            <Undo2 size={12} /> Desfazer
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button 
            onClick={() => engine.processSpin(0)} 
            disabled={engine.isLocked}
            className="col-span-4 py-4 rounded bg-steel/20 border border-neon text-neon font-bold active:bg-neon active:text-obsidian active:scale-[0.98] transition-all text-lg disabled:opacity-30 disabled:border-gray-600 disabled:text-gray-600"
          >
            0 - GREEN
          </button>
          
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(num => (
            <button 
              key={num}
              onClick={() => engine.processSpin(num)}
              disabled={engine.isLocked}
              className={`py-4 rounded border font-bold active:scale-90 transition-all ${getNumberColor(num)} bg-steel/10 text-lg shadow-sm disabled:opacity-30 disabled:border-gray-800 disabled:bg-transparent`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* ZONA D: Command Center */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-void border-t border-steel/30 flex justify-around items-center z-50 px-2 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors p-2">
          <BarChart2 size={22} />
          <span className="text-[9px] font-sans uppercase">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors p-2">
          <Scale size={22} />
          <span className="text-[9px] font-sans uppercase">Weights</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-neon hover:text-white active:scale-90 transition-all p-2">
          <TerminalSquare size={26} />
          <span className="text-[10px] font-sans uppercase font-bold text-shadow">Terminal</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors p-2">
          <Settings size={22} />
          <span className="text-[9px] font-sans uppercase">Config</span>
        </button>
      </div>
    </div>
  );
}
EOF

echo "[RL.SYS] O Cérebro (Hook HFT) foi instalado. HMR recarregando..."
echo "======================================"
