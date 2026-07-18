#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 601"
echo " PWA ENTERPRISE UI (REACT + TAILWIND)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[RL.SYS] Criando infraestrutura PWA..."
mkdir -p pwa-terminal/src
cd pwa-terminal

# 1. Package.json (Vite + React + Tailwind + Lucide)
cat > package.json <<'EOF'
{
  "name": "rl-sys-pwa",
  "private": true,
  "version": "5.21.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.300.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
EOF

# 2. Vite Config
cat > vite.config.ts <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
EOF

# 3. Tailwind & PostCSS Config
cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0A0A',
        void: '#111111',
        neon: '#00FF41',
        blood: '#FF003C',
        steel: '#4A4A4A'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Roboto Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
EOF

cat > postcss.config.js <<'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# 4. Index HTML
cat > index.html <<'EOF'
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0A0A0A" />
    <title>RL.SYS - Tactical Terminal</title>
  </head>
  <body class="bg-obsidian text-gray-300 font-mono overflow-hidden">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# 5. TS Config
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > tsconfig.node.json <<'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# 6. React Core (Main & CSS)
cat > src/index.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
EOF

cat > src/main.tsx <<'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# 7. Enterprise UI Component (App.tsx)
cat > src/App.tsx <<'EOF'
import React, { useState } from 'react';
import { ShieldAlert, Activity, Target, Crosshair, History, Server } from 'lucide-react';

export default function App() {
  // Estados Visuais para a HUD
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
    <div className="h-screen w-full bg-obsidian flex flex-col no-scrollbar">
      {/* ZONA A: Global HUD */}
      <div className="bg-void border-b border-steel/30 p-4 shrink-0">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-gray-500 font-sans tracking-widest uppercase flex items-center gap-1">
              <Server size={12} className="text-neon" /> RL.SYS ONLINE
            </div>
            <div className="text-3xl font-bold text-yellow-500 mt-1">
              R$ {bankroll.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase flex items-center justify-end gap-1">
              <Activity size={12} className="text-blood" /> VIX ENTROPY
            </div>
            <div className="text-xl font-bold text-blood mt-1">{vix.toFixed(1)}%</div>
          </div>
        </div>

        {/* Milestones Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><ShieldAlert size={10} className="text-blood"/> STOP: R$ {stopLoss.toFixed(2)}</span>
            <span className="flex items-center gap-1">ALVO: R$ {targetProfit.toFixed(2)} <Target size={10} className="text-neon"/></span>
          </div>
          <div className="w-full h-1 bg-steel/20 rounded overflow-hidden flex">
            <div className="h-full bg-neon w-[80%] shadow-[0_0_10px_#00FF41]"></div>
          </div>
        </div>
      </div>

      {/* ZONA B: Radar Térmico (Timeline) */}
      <div className="py-3 px-2 border-b border-steel/30 shrink-0 bg-void/50">
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1 px-2">
          <History size={10}/> TIMELINE RECENTE
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-2">
          {timeline.map((num, idx) => (
            <div key={idx} className={`shrink-0 w-10 h-10 flex items-center justify-center rounded border bg-obsidian text-lg font-bold ${getNumberColor(num)}`}>
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* ZONA C: Painel de Combate */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto no-scrollbar">
        
        {/* Ordem Tática */}
        <div className="bg-steel/10 border border-neon/50 rounded-lg p-3 mb-4 shrink-0">
          <div className="text-xs text-neon mb-1 flex items-center gap-1">
            <Crosshair size={12}/> ENGAGE AUTORIZADO
          </div>
          <div className="text-sm text-gray-300">Estratégia: <span className="font-bold text-white">SECTOR_POTINHO</span></div>
          <div className="text-sm text-gray-300">Stake Global: <span className="font-bold text-yellow-500">R$ 4.40</span></div>
          <div className="text-xs text-gray-400 mt-2">Cobertura Plena: 22 fichas (R$ 0.20/cada)</div>
        </div>

        {/* Numpad Tático para Inserção com 1 Mão */}
        <div className="flex-1 grid grid-cols-4 gap-2 content-end">
          <button onClick={() => handleNumpad(0)} className="col-span-4 py-3 rounded bg-steel/20 border border-neon text-neon font-bold active:bg-neon active:text-obsidian transition-colors">
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
              className={`py-3 rounded border font-bold active:scale-95 transition-transform ${getNumberColor(num)} bg-steel/10`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
EOF

echo "[RL.SYS] Instalando dependências (Isso pode levar alguns minutos no A50)..."
npm install

echo "======================================"
echo "[RL.SYS] SPRINT 601 CONCLUÍDA COM SUCESSO."
echo "Para iniciar a PWA tática, execute:"
echo "cd pwa-terminal && npm run dev"
echo "======================================"
