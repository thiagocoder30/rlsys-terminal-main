#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 601.1"
echo " NUMPAD HOTFIX & COMMAND CENTER"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR/pwa-terminal"

cat > src/App.tsx <<'EOF'
import React, { useState } from 'react';
import { 
  ShieldAlert, Activity, Target, Crosshair, History, Server, 
  Undo2, BarChart2, Scale, TerminalSquare, Settings 
} from 'lucide-react';

export default function App() {
  const [bankroll, setBankroll] = useState(171.00);
  const [timeline, setTimeline] = useState([12, 17, 12, 18, 23, 33, 11, 32, 8]);
  const [vix, setVix] = useState(99.9);
  
  const targetProfit = 180.00;
  const stopLoss = 145.35;

  const handleNumpad = (num: number) => {
    setTimeline(prev => [...prev.slice(-14), num]);
  };

  const getNumberColor = (num: number) => {
    if (num === 0) return 'text-neon border-neon';
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return reds.includes(num) ? 'text-blood border-blood' : 'text-gray-400 border-gray-600';
  };

  return (
    <div className="h-screen w-full bg-obsidian flex flex-col overflow-hidden relative">
      {/* ZONA A: Global HUD */}
      <div className="bg-void border-b border-steel/30 p-4 shrink-0 z-10 shadow-md">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-sans tracking-widest uppercase flex items-center gap-1">
              <Server size={12} className="text-neon" /> RL.SYS ONLINE
            </div>
            <div className="text-3xl font-bold text-yellow-500 mt-1">
              R$ {bankroll.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-end gap-1">
              <Activity size={12} className="text-blood" /> VIX ENTROPY
            </div>
            <div className="text-xl font-bold text-blood mt-1">{vix.toFixed(1)}%</div>
          </div>
        </div>

        {/* Milestones Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-gray-400 font-sans">
            <span className="flex items-center gap-1"><ShieldAlert size={10} className="text-blood"/> STOP: R$ {stopLoss.toFixed(2)}</span>
            <span className="flex items-center gap-1">ALVO: R$ {targetProfit.toFixed(2)} <Target size={10} className="text-neon"/></span>
          </div>
          <div className="w-full h-1 bg-steel/20 rounded overflow-hidden flex">
            <div className="h-full bg-neon w-[90%] shadow-[0_0_10px_#00FF41]"></div>
          </div>
        </div>
      </div>

      {/* ZONA B: Radar Térmico (Timeline) */}
      <div className="py-2 px-2 border-b border-steel/30 shrink-0 bg-void/50 z-10">
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1 px-2 font-sans uppercase">
          <History size={10}/> Timeline Recente
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-2">
          {timeline.map((num, idx) => (
            <div key={idx} className={`shrink-0 w-9 h-9 flex items-center justify-center rounded border bg-obsidian text-base font-bold ${getNumberColor(num)}`}>
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* ZONA C: Painel de Combate (Agora com Scroll Ativo) */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto no-scrollbar pb-24">
        
        {/* Ordem Tática */}
        <div className="bg-steel/10 border border-neon/50 rounded-lg p-3 mb-4 shrink-0">
          <div className="text-xs text-neon mb-1 flex items-center gap-1 font-sans uppercase">
            <Crosshair size={12}/> Engage Autorizado
          </div>
          <div className="text-sm text-gray-300">Estratégia: <span className="font-bold text-white">SECTOR_POTINHO</span></div>
          <div className="text-sm text-gray-300">Stake Global: <span className="font-bold text-yellow-500">R$ 4.40</span></div>
          <div className="text-[10px] text-gray-400 mt-2 font-sans">Cobertura Plena: 22 fichas (R$ 0.20/cada)</div>
        </div>

        {/* Header do Numpad com UNDO */}
        <div className="flex justify-between items-center mb-2 shrink-0">
          <span className="text-[10px] text-gray-500 font-sans uppercase">Input Tático</span>
          <button className="text-gray-400 bg-steel/20 px-3 py-1.5 rounded flex items-center gap-1 text-[10px] uppercase font-bold active:bg-steel/40 active:text-white transition-colors">
            <Undo2 size={12} /> Desfazer
          </button>
        </div>

        {/* Numpad Tático */}
        <div className="grid grid-cols-4 gap-2 pb-4">
          <button onClick={() => handleNumpad(0)} className="col-span-4 py-3 rounded bg-steel/20 border border-neon text-neon font-bold active:bg-neon active:text-obsidian transition-colors text-lg">
            0 - GREEN
          </button>
          
          {[
            1,2,3,4,
            5,6,7,8,
            9,10,11,12,
            13,14,15,16,
            17,18,19,20,
            21,22,23,24,
            25,26,27,28,
            29,30,31,32,
            33,34,35,36
          ].map(num => (
            <button 
              key={num}
              onClick={() => handleNumpad(num)}
              className={`py-3 rounded border font-bold active:scale-95 transition-transform ${getNumberColor(num)} bg-steel/10 text-lg`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* ZONA D: Command Center (Substitui o CLI antigo) */}
      <div className="absolute bottom-0 left-0 w-full bg-void border-t border-steel/30 px-6 py-3 flex justify-between items-center z-20 pb-safe">
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors">
          <BarChart2 size={20} />
          <span className="text-[9px] font-sans uppercase">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors">
          <Scale size={20} />
          <span className="text-[9px] font-sans uppercase">Weights</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-neon hover:text-white active:scale-95 transition-all">
          <TerminalSquare size={24} />
          <span className="text-[9px] font-sans uppercase font-bold">Terminal</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:text-neon transition-colors">
          <Settings size={20} />
          <span className="text-[9px] font-sans uppercase">Config</span>
        </button>
      </div>

    </div>
  );
}
EOF

echo "[RL.SYS] Hotfix aplicado. Reiniciando compilação do Vite..."
echo "======================================"
