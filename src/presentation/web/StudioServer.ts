import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3000;

const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RL.SYS - Web Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style> body { background-color: #0f172a; color: #f8fafc; } </style>
</head>
<body class="p-4 sm:p-8">
    <div class="max-w-6xl mx-auto space-y-6">
        
        <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-700 pb-4">
            <div>
                <h1 class="text-3xl font-bold text-cyan-400 tracking-wider">RL.SYS <span class="text-white text-xl">STUDIO</span></h1>
                <p class="text-slate-400 text-sm">HFT Tactical Dashboard</p>
            </div>
            <div class="mt-4 sm:mt-0 flex space-x-4">
                <div class="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span class="text-xs text-slate-400 uppercase tracking-widest block">Status</span>
                    <span id="status-badge" class="text-sm font-semibold text-green-400">● ONLINE</span>
                </div>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <span class="text-slate-400 text-sm font-medium">Banca Atual</span>
                <div class="text-3xl font-bold text-white mt-1" id="val-bankroll">R$ 0.00</div>
                <div class="flex justify-between mt-2 text-xs">
                    <span class="text-red-400">SL: <span id="val-sl">0</span></span>
                    <span class="text-green-400">TP: <span id="val-tp">0</span></span>
                </div>
            </div>
            
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <span class="text-slate-400 text-sm font-medium">Entropia (VIX)</span>
                <div class="text-3xl font-bold text-white mt-1" id="val-vix">0.0%</div>
                <div class="w-full bg-slate-700 rounded-full h-2 mt-3">
                    <div class="bg-cyan-400 h-2 rounded-full" id="bar-vix" style="width: 0%"></div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg border-l-4 border-l-cyan-500">
                <span class="text-slate-400 text-sm font-medium">Estratégia Ativa</span>
                <div class="text-xl font-bold text-cyan-300 mt-1 truncate" id="val-strategy">Aguardando...</div>
                <div class="mt-2 text-sm text-slate-300">Stake: <span id="val-stake" class="text-green-400 font-bold">R$ 0.00</span></div>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-semibold text-slate-200">Curva de Capital (PnL)</h2>
            </div>
            <div class="relative h-64 w-full">
                <canvas id="pnlChart"></canvas>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <h2 class="text-lg font-semibold text-slate-200 mb-3">Timeline Recente</h2>
            <div class="flex flex-wrap gap-2" id="timeline-container">
                </div>
        </div>

    </div>

    <script>
        const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        
        let pnlChartInstance = null;

        function initChart() {
            const ctx = document.getElementById('pnlChart').getContext('2d');
            pnlChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Banca (R$)', data: [], borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }
            });
        }

        async function fetchTelemetry() {
            try {
                const res = await fetch('/api/telemetry');
                if (!res.ok) throw new Error('Sem dados');
                const data = await res.json();
                
                document.getElementById('status-badge').innerText = '● ONLINE';
                document.getElementById('status-badge').className = 'text-sm font-semibold text-green-400';

                document.getElementById('val-bankroll').innerText = 'R$ ' + data.bankroll.toFixed(2);
                document.getElementById('val-sl').innerText = 'R$ ' + data.stopLoss.toFixed(2);
                document.getElementById('val-tp').innerText = 'R$ ' + data.takeProfit.toFixed(2);
                
                document.getElementById('val-vix').innerText = data.vix.toFixed(1) + '%';
                document.getElementById('bar-vix').style.width = data.vix + '%';
                
                document.getElementById('val-strategy').innerText = data.strategy.replace(/_/g, ' ');
                document.getElementById('val-stake').innerText = 'R$ ' + data.stake.toFixed(2);

                if(pnlChartInstance && data.pnlCurve) {
                    pnlChartInstance.data.labels = data.pnlCurve.map((_, i) => i);
                    pnlChartInstance.data.datasets[0].data = data.pnlCurve;
                    pnlChartInstance.update();
                }

                if(data.recentSpins) {
                    const cont = document.getElementById('timeline-container');
                    cont.innerHTML = '';
                    data.recentSpins.forEach(n => {
                        let colorClass = 'bg-slate-600';
                        if (n === 0) colorClass = 'bg-green-600';
                        else if (RED_NUMS.includes(n)) colorClass = 'bg-red-600';
                        
                        cont.innerHTML += \`<div class="w-10 h-10 flex items-center justify-center rounded-full \${colorClass} text-white font-bold text-lg shadow">\${n}</div>\`;
                    });
                }

            } catch(e) {
                document.getElementById('status-badge').innerText = '○ OFFLINE';
                document.getElementById('status-badge').className = 'text-sm font-semibold text-slate-500';
            }
        }

        initChart();
        setInterval(fetchTelemetry, 2000); // Atualiza a cada 2 segundos
        fetchTelemetry();
    </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
    } else if (req.url === '/api/telemetry') {
        const telemetryPath = path.join(process.cwd(), 'data', 'live-telemetry.json');
        try {
            if (fs.existsSync(telemetryPath)) {
                const data = fs.readFileSync(telemetryPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } else {
                res.writeHead(404);
                res.end('{"error": "Aguardando dados da sessao..."}');
            }
        } catch (e) {
            res.writeHead(500);
            res.end('{"error": "Erro de leitura"}');
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[36m[WEB STUDIO] Servidor operando na porta ${PORT}\x1b[0m`);
    console.log(`Abra no navegador do seu celular: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
});
