import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Activity, Target, Crosshair, History, Server, Undo2, BarChart2, Scale, TerminalSquare, Settings, Lock, X, Zap, Cpu } from 'lucide-react';
import { useTacticalEngine } from './core/useTacticalEngine';

export default function App() {
  const engine = useTacticalEngine(55.00); 
  const [activeModal, setActiveModal] = useState<'STATS' | 'WEIGHTS' | 'TERMINAL' | 'CONFIG' | null>(null);
  const [termInput, setTermInput] = useState('');
  const [fastInput, setFastInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Ref para garantir que o celular VIBRE APENAS UMA VEZ por ativação de tática, barrando surtos
  const lastVibratedStrategy = useRef<string | null>(null);

  useEffect(() => {
      if (engine.activeStrategy && !engine.isLocked) {
          if (lastVibratedStrategy.current !== engine.activeStrategy) {
              if ('vibrate' in navigator) navigator.vibrate([150, 50, 150]);
              lastVibratedStrategy.current = engine.activeStrategy;
          }
      } else {
          lastVibratedStrategy.current = null;
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
    const isRawNumbers = /^[\d\s,]+$/.test(cmd) && cmd.includes(',');

    if (cmd.startsWith('sync ') || isRawNumbers) {
      const payload = cmd.startsWith('sync ') ? cmd.substring(5) : cmd;
      const strNums = payload.split(',');
      const nums = strNums.map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 36);
      if (nums.length > 0) engine.syncTape(nums);
    } else if (cmd.startsWith('setbankroll ')) {
      const val = parseFloat(cmd.substring(12));
      if (!isNaN(val) && val >= 0) engine.setManualBankroll(val);
    } else if (cmd === 'reset') {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleFastInput = (e: React.FormEvent | React.MouseEvent, isSkip: boolean = false) => {
      e.preventDefault();
      const num = parseInt(fastInput.trim(), 10);
      if (!isNaN(num) && num >= 0 && num <= 36) {
          if (isSkip) engine.skipSpin(num); 
          else engine.processSpin(num);
          setFastInput('');
          if (inputRef.current) inputRef.current.focus();
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

      {/* ZONA DO ORÁCULO TÁTICO */}
      <div className="flex-none bg-blue-900/10 border-b border-blue-500/30 p-2 z-20">
         <div className="flex items-start gap-2 text-blue-400 text-xs">
            <Cpu size={14} className="shrink-0 mt-0.5" />
            <span className="leading-snug font-sans tracking-wide">{engine.oracleMessage}</span>
         </div>
      </div>

      {/* ZONA C: Painel de Combate Puro */}
      <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar p-4 pb-28 z-0">
        
        {/* Caixa de Engage com Auditoria XAI */}
        {engine.isLocked ? (
           <div className="bg-blood/10 border border-blood rounded-lg p-4 mb-4 flex flex-col items-center justify-center text-center">
             <Lock size={24} className="text-blood mb-2"/>
             <div className="text-sm font-bold text-blood uppercase">{engine.lockReason}</div>
           </div>
        ) : engine.activeStrategy ? (
            <div className="bg-steel/10 border border-neon/50 rounded-lg p-3 mb-4 shadow-[0_0_15px_rgba(0,255,65,0.1)] transition-all flex-none">
                <div className="text-xs text-neon mb-1 flex items-center gap-1 font-sans uppercase"><Crosshair size={12}/> Engage Autorizado</div>
                <div className="text-sm">Estratégia: <span className="font-bold text-white">{engine.activeStrategy}</span></div>
                <div className="text-sm">Stake Global: <span className="font-bold text-yellow-500">R$ {engine.activeStake.toFixed(2)}</span></div>
                <div className="text-xs text-neon font-bold mt-2 font-sans bg-obsidian border border-neon/30 p-2 rounded tracking-widest uppercase">{engine.activeDesc}</div>
                <div className="mt-2 text-[9px] text-gray-500 font-sans border-t border-steel/20 pt-2">AUDIT: {engine.auditReason}</div>
            </div>
        ) : (
            <div className="bg-steel/10 border border-gray-600 rounded-lg p-3 mb-4 flex-none">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 font-sans uppercase"><Activity size={12}/> Standby Mode</div>
                <div className="text-sm text-gray-400">Aguardando convergência tática...</div>
                <div className="mt-2 text-[9px] text-gray-500 font-sans border-t border-steel/20 pt-2">AUDIT: {engine.auditReason}</div>
            </div>
        )}

        {/* CLI LIVE LOG TERMINAL */}
        <div className="flex-1 bg-void border border-steel/30 rounded p-2 mb-4 overflow-y-auto font-mono text-[10px] flex flex-col-reverse shadow-inner min-h-[100px]">
            {engine.actionLogs.map((log, i) => (
                <div key={i} className={`mb-1 leading-tight ${log.startsWith('[WIN]') ? 'text-neon' : log.startsWith('[LOSS]') || log.startsWith('[ALERTA]') ? 'text-blood' : log.startsWith('[SYS]') ? 'text-yellow-500' : 'text-gray-400'}`}>
                    {log}
                </div>
            ))}
        </div>

        {/* CONSOLE NUMÉRICO GIGANTE */}
        <div className="flex-none">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-neon font-bold font-sans uppercase tracking-widest flex items-center gap-1">
                    <Zap size={10} /> Terminal de Fogo
                </span>
                <button onClick={engine.undoSpin} className="text-gray-400 bg-steel/20 px-3 py-1 rounded flex items-center gap-1 text-[9px] uppercase font-bold active:bg-steel/40 active:text-white transition-colors">
                    <Undo2 size={10} /> Undo
                </button>
            </div>
            
            <form onSubmit={(e) => handleFastInput(e, false)} className="flex gap-2 bg-void p-3 rounded-xl border border-neon/30 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
                <div className="flex-1">
                    <input 
                        ref={inputRef}
                        type="number" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={fastInput} 
                        onChange={e => setFastInput(e.target.value)} 
                        placeholder="Nº..." 
                        className="w-full bg-obsidian border border-steel/30 rounded-lg text-center text-white text-3xl font-bold focus:outline-none focus:border-neon focus:shadow-[0_0_10px_#00FF4140] font-mono py-2"
                        disabled={engine.isLocked}
                        autoFocus
                    />
                </div>
                <div className="flex flex-col gap-2 w-24">
                    <button 
                        type="button"
                        onClick={(e) => handleFastInput(e, true)}
                        disabled={engine.isLocked || !fastInput} 
                        className="flex-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 rounded-lg text-[10px] uppercase font-bold active:bg-yellow-500 active:text-obsidian transition-colors disabled:opacity-30"
                    >
                        Pular
                    </button>
                    <button 
                        type="submit" 
                        disabled={engine.isLocked || !fastInput} 
                        className="flex-1 bg-neon/20 text-neon border border-neon/50 rounded-lg text-[10px] uppercase font-bold active:bg-neon active:text-obsidian transition-colors disabled:opacity-30"
                    >
                        Lançar
                    </button>
                </div>
            </form>
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
                  {engine.actionLogs.map((log, i) => <div key={i} className={`mb-1 ${log.startsWith('[WIN]') ? 'text-neon' : log.startsWith('[LOSS]') || log.startsWith('[ALERTA]') ? 'text-blood' : log.startsWith('[SYS]') ? 'text-yellow-500' : 'text-gray-400'}`}>{log}</div>)}
                </div>
                <form onSubmit={handleTerminalSubmit} className="flex gap-2 shrink-0">
                  <input type="text" value={termInput} onChange={e => setTermInput(e.target.value)} placeholder="Cole a fita / Comando..." className="flex-1 bg-steel/20 border border-steel/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon text-white font-mono" />
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
                        <button onClick={() => engine.toggleStrategy(strat)} className={`px-2 py-1 rounded text-[9px] uppercase font-bold border transition-colors ${isDisable ? 'border-blood/40 text-blood bg-blood/10' : 'border-neon/40 text-neon bg-neon/10'}`}>
                            {isDisable ? 'OFF' : 'ON'}
                        </button>
                        <span className={`font-bold ${isDisable ? 'text-gray-600 line-through' : w >= 2.0 ? 'text-white' : 'text-gray-400'}`}>
                           {strat.replace('CROSS_', '').replace('SECTOR_', '').replace('ZONE_', '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className={pnlValue >= 0 ? 'text-neon' : 'text-blood'}>{pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)}</span>
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
                    <label className="text-xs uppercase text-gray-500 font-sans tracking-widest block mb-2">Provedor Ativo</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => engine.setProvider('PRAGMATIC')} className={`py-3 rounded font-bold uppercase text-xs border transition-all ${engine.provider === 'PRAGMATIC' ? 'bg-neon text-obsidian border-neon' : 'bg-steel/10 text-gray-400 border-steel/30'}`}>Pragmatic (R$ 0,10)</button>
                        <button onClick={() => engine.setProvider('EVOLUTION')} className={`py-3 rounded font-bold uppercase text-xs border transition-all ${engine.provider === 'EVOLUTION' ? 'bg-neon text-obsidian border-neon' : 'bg-steel/10 text-gray-400 border-steel/30'}`}>Evolution (R$ 0,50)</button>
                    </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase text-gray-500 font-sans tracking-widest">Comandos Administrativos:</p>
                  <div className="bg-steel/10 p-3 rounded font-mono text-xs text-white">setbankroll [valor]</div>
                  <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full bg-blood/10 border border-blood text-blood py-3 rounded uppercase font-bold text-xs mt-4 active:bg-blood active:text-white transition-colors">
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
