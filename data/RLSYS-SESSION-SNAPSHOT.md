# 🛡️ RL.SYS CORE - ARCHITECTURAL CONTEXT SNAPSHOT
Este documento contém o estado da arte e a especificação técnica do terminal quantitativo RL.SYS, permitindo que qualquer instância de IA retome o desenvolvimento sem perda de contexto histórico.

## 🏁 Status Atual do Desenvolvimento
- **Última Sprint Concluída:** Sprint 455 (Persistent Daily Lockdown & Type Safety Fix).
- **Ambiente de Execução:** Node.js v26.3.0 rodando nativamente dentro do Termux (Android).
- **Ponto de Entrada Global:** O comando de sistema `rlsys` aponta para `dist/main.js`.

## 🧠 Arquitetura e Engenharia do Núcleo (V4.5)
1. **Multi-Armed Bandit Decision Engine (RL):** O sistema roda um loop de aprendizado por reforço. Avalia o resultado de cada giro contra todas as estratégias em background (Shadow Trading), penalizando as que erram e bonificando com pesos dinâmicos as que acertam. A de maior peso é promovida a Campeã.
2. **Auto-Settlement (Caixa Automatizado):** O operador apenas insere o número que caiu na roleta. O sistema deduz de forma autônoma se a estratégia indicada obteve Win ou Loss, calcula o PnL real e atualiza o saldo da banca instantaneamente.
3. **Dynamic Kelly Criterion Constrained:** Dimensionamento de lote baseado na confiança estatística da janela móvel de 90 giros, adaptado milimetricamente para o piso da Pragmatic Play (Ficha mínima de R$ 0,10 e arredondamentos em múltiplos simétricos).
4. **Chip Placement Instructions:** O HUD exibe a linha `APLICAÇÃO`, traduzindo a stake global em ordens exatas de cliques (ex: R$ 0.10 na Coluna 1 e R$ 0.10 na Coluna 3).
5. **Persistent Daily Lockdowns (Circuit Breakers):** - **Stop Loss:** Se o drawdown real atingir 15% da banca, gera um arquivo `.rlsys-lock` e bloqueia o boot do sistema por **12 horas**.
   - **Take Profit:** Se o ganho real atingir o degrau M3 da meta global, gera o bloqueio e impede a execução por **4 horas**.

## 📁 Estrutura de Arquivos Críticos do Repositório
- `src/main.ts`: Inicializa adaptadores de persistência local, o rastreador de mesa e invoca o Orquestrador.
- `src/presentation/cli/LivePaperOrchestrator.ts`: O cérebro do sistema. Contém o HUD, gerenciador de eventos do terminal, loop de Kelly, Shadow Trading e regras dos disjuntores.
- `src/domain/financial/AutoSettlementEngine.ts`: Dicionário mestre contendo as definições e regras de cobertura das estratégias (`CROSS_GRID_HEDGE`, `FUSION_REDUZIDA`, `TRIPLICACAO_RED`, etc).
- `data/bankroll-state.json`: Arquivo de persistência local do saldo da banca real.

## 🛠️ Próximos Passos Planejados
- Evolução do monitoramento de entropia curta e calibração de limites de volatilidade do VIX.
