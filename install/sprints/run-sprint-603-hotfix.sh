#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 603.1"
echo " TERMINAL AUTO-SYNC HOTFIX"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR/pwa-terminal"

# Atualizando apenas o App.tsx com a Regex de Auto-Detecção no Terminal
cat > src/App.tsx <<'EOF'
import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Activity, Target, Crosshair, History, Server, Undo2, BarChart2, Scale, TerminalSquare, Settings, Lock, X } from 'lucide-react';
import { useTacticalEngine } from './core/useTacticalEngine';

export default function App() {
  const engine = useTacticalEngine(171.00);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [activeModal, setActiveModal] = useState<'STATS' | 'WEIGHTS' | 'TERMINAL' | 'CONFIG' | null>(null);
  const [termInput, setTermInput] = useState('');
  const [termLog, setTermLog] = useState<string[]>(['[SISTEMA] RL.SYS CLI Emulator Online.', 'Cole os números separados por vírgula para sincronizar.']);

  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
  }, [engine.timeline]);

  const getNumberColor = (num: number) => {
    if (num === 0) return 'text-neon border-neon';
    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return reds.includes(num) ? 'text-blood border-blood shadow-[0_0_5px_#FF003C40]' : 'text-gray-300 border-gray-600';
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termInput.trim().toLowerCase();
    setTermInput('');
    
    // Mostra o comando truncado no log se for muito grande
    const logCmd = cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd;
    setTermLog(prev => [...prev, `> ${logCmd}`]);

    // Regex de Auto-Detecção: Aceita se a string tiver apenas números, vírgulas e espaços
    const isRawNumbers = /^[\d\s,]+$/.test(cmd) && cmd.includes(',');

    if (cmd.startsWith('sync ') || isRawNumbers) {
      const payload = cmd.startsWith('sync ') ? cmd.substring(5) : cmd;
      const strNums = payload.split(',');
      const nums = strNums.map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 36);
      
      if (nums.length > 0) {
        engine.syncTape(nums);
        setTermLog(prev => [...prev, `[OK] ${nums.length} giros sincronizados com sucesso.`]);
      } else {
        setTermLog(prev => [...prev, '[ERRO] Formato inválido. Use: 10, 25, 0']);
      }
    } else if (cmd.startsWith('setbankroll ')) {
      const val = parseFloat(cmd.substring(12));
      if (!isNaN(val) && val >= 0) {
        engine.setManualBankroll(val);
        setTermLog(prev => [...prev, `[OK] Banca calibrada para R$ ${val.toFixed(2)}`]);
      }
    } else if (cmd === 'clear') {
      setTermLog([]);
    } else {
      setTermLog(prev => [...prev, '[ERRO] Comando não reconhecido.']);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-obsidian flex flex-col overflow-hidden relative font-mono text-gray-300 select-none">
      
      {/* ZONA A: Global HUD */}
      <div className="flex-none bg-void border-b border-steel/30 p-4 z-20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-sans tracking-widest uppercase flex items-center gap-1">
              <Server size={12} className={engine.isLocked ? "text-blood" : "text-neon"} /> 
              {engine.isLocked ? "RL.SYS TRAVADO" : "RL.SYS ONLINE"}
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
      <div className="flex-none py-2 px-2 border-b border-steel/30 bg-void/50 z-20 shadow-sm">
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1 px-2 font-sans uppercase">
          <History size={10}/> Timeline Recente
        </div>
        <div ref={timelineRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-2 scroll-smooth">
          {engine.timeline.length === 0 ? (
            <div className="text-xs text-gray-600 font-sans h-10 flex items-center">Aguardando sync...</div>
          ) : (
            engine.timeline.map((num, idx) => (
              <div key={idx} className={`shrink-0 w-10 h-10 flex items-center justify-center rounded border bg-obsidian text-base font-bold ${getNumberColor(num)}`}>{num}</div>
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
                <div className="text-[10px] text-gray-400 mt-2 font-sans">Cobertura: {engine.activeCoverage} fichas em jogo.</div>
            </div>
        ) : (
            <div className="bg-steel/10 border border-gray-600 rounded-lg p-3 mb-4 opacity-50">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 font-sans uppercase"><Activity size={12}/> Standby Mode</div>
                <div className="text-sm text-gray-400">Aguardando alinhamento térmico...</div>
            </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-gray-500 font-sans uppercase">Input Tático</span>
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
                  <input type="text" value={termInput} onChange={e => setTermInput(e.target.value)} placeholder="Cole os números aqui..." className="flex-1 bg-steel/20 border border-steel/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon text-white font-mono" />
                  <button type="submit" className="bg-neon text-obsidian px-4 py-2 rounded font-bold uppercase text-xs">Run</button>
                </form>
              </div>
            )}

            {activeModal === 'WEIGHTS' && (
              <div className="space-y-2 text-xs">
                {Object.entries(engine.shadowWeights).sort((a,b) => b[1] - a[1]).map(([strat, w]) => (
                  <div key={strat} className="flex justify-between items-center border-b border-steel/20 py-2">
                    <span className={w >= 2.0 ? 'text-neon' : 'text-gray-400'}>{strat.replace('CROSS_', '').replace('SECTOR_', '').replace('ZONE_', '')}</span>
                    <span className="font-bold">{w.toFixed(2)}</span>
                  </div>
                ))}
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
              <div className="text-sm text-gray-400 space-y-4">
                <p>Comandos Administrativos:</p>
                <div className="bg-steel/10 p-3 rounded font-mono text-xs text-white">setbankroll [valor]</div>
                <div className="bg-steel/10 p-3 rounded font-mono text-xs text-white">clear (limpa log do terminal)</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
EOF

echo "[RL.SYS] Hotfix Auto-Sync aplicado. HMR em andamento..."
echo "======================================"
