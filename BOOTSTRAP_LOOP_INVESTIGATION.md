[RELATÓRIO DE INVESTIGAÇÃO ARQUITETURAL - BOOTSTRAP LOOP ANALYSIS]

==========================================================
1. FLUXO COMPLETO ENCONTRADO
==========================================================
O fluxo de inicialização entra em um loop infinito porque o componente React `OperatorConsole` possui um bug de "stale closure" (fechamento obsoleto) no `setInterval` responsável pelo polling, e os comandos de frontend não alteram adequadamente o estado do backend na engine de sessão.

Fluxo Real:
App -> OperatorConsole (Mount)
↓
useEffect([]) dispara `fetchData()` e cria um `setInterval(fetchData, 1500)`.
Neste momento, as variáveis de estado capturadas pelo closure do `setInterval` são: `hasInitialLoad = false`, `showResumePrompt = false`.
↓
O backend relata que a sessão está ativa (`sessionObj.status === 'ACTIVE'` ou `bootData.decision === 'READY_FOR_SESSION'`).
↓
O `fetchData()` avalia `if (!hasInitialLoad)` (que no closure do intervalo será eternamente `true`) e executa `setShowResumePrompt(true)`.
↓
O modal "Sessão Ativa Detectada" é exibido.

==========================================================
2. ÁRVORE DOS COMPONENTES ENVOLVIDOS
==========================================================
- Frontend: `OperatorConsole.tsx`
- HTTP Controllers: `OperatorController.ts` (método `resetStartup`)
- Application: `ApplicationBootstrap.ts`, `SessionStartupWizard.ts`, `SessionControlEngine.ts`, `RuntimeConfigurationLoader.ts`, `BootstrapValidator.ts`

==========================================================
3. FLUXO DO BOOTSTRAP
==========================================================
ApplicationBootstrap.bootstrap()
↓
RuntimeConfigurationLoader.loadState() (Verifica se SessionControlEngine tem sessão ativa e se StartupWizard está concluído)
↓
BootstrapValidator.validate() (Retorna `READY_FOR_SESSION` se válido e configurado, ou `READY_FOR_STARTUP`)
↓
Retorna RuntimeConfigurationState.

Nota: O validador não retorna `ALREADY_ACTIVE`. Ele retorna apenas `READY_FOR_SESSION` ou `READY_FOR_STARTUP`. O frontend trata `ALREADY_ACTIVE` por legado ou segurança.

==========================================================
4. FLUXO DO CONTINUE (Continuar Sessão)
==========================================================
Modal Button "Continuar Sessão"
↓
onClick() dispara `setShowResumePrompt(false)` e `setIsConfiguring(false)`.
↓
NENHUMA requisição é enviada ao backend.
NENHUM método `resumeSession()` existe ou é chamado.
↓
1.5s depois, o `setInterval` dispara o `fetchData` com o estado obsoleto (`hasInitialLoad = false`).
↓
O IF volta a avaliar `!hasInitialLoad` como verdadeiro e chama `setShowResumePrompt(true)`.
↓
LOOP INFINITO (O modal reaparece).

==========================================================
5. FLUXO DO NOVA SESSÃO (Nova Sessão)
==========================================================
Modal Button "Nova Sessão"
↓
onClick() dispara `setShowResumePrompt(false)`, `setForceWizard(true)`, `setIsConfiguring(true)`, `setWizardStep(1)`.
↓
Dispara `fetch('/api/operator/startup/reset', { method: 'POST' })`.
↓
OperatorController.resetStartup() chama `this.runtime.sessionStartupWizard.reset()`.
↓
O `SessionStartupWizard` reinicia seus próprios estados (`NOT_STARTED`), PORÉM o `SessionControlEngine` NUNCA é chamado. A sessão ativa anterior não recebe `finishSession()`.
↓
O polling continua detectando que `sessionObj.status === 'ACTIVE'`.
↓
O `setInterval` com state obsoleto (`hasInitialLoad = false`) dispara.
↓
O modal reaparece.
↓
LOOP INFINITO.

==========================================================
6. FLUXO DO RUNTIME CONFIGURATION STATE
==========================================================
Quem modifica: `RuntimeConfigurationLoader` gera uma nova cópia baseada no `ConfigurationEngine`, `SessionControlEngine` e `SessionStartupWizard`.
Quem observa: O frontend através do polling de `fetchData()`.
Quem atualiza: É atualizado via eventos de sync.
A fonte de verdade: A união de 3 instâncias independentes.

==========================================================
7. FLUXO DO SESSION CONTROL ENGINE
==========================================================
Verificações realizadas:
- `startSession(initialBankroll, tableConfig)`: Existe e funciona.
- `finishSession(reason)`: Existe e funciona.
- `resumeSession()`: INEXISTENTE.
- `clearSession()`: INEXISTENTE.
A sessão nunca é finalizada quando o operador seleciona "Nova Sessão", pois o controller não invoca `finishSession()`.

==========================================================
8. FLUXO DO STARTUP WIZARD
==========================================================
Ele existe e é chamado corretamente, mas no cenário de "Nova Sessão" ele é apenas "resetado", não sendo capaz de forçar o término da sessão ativa no `SessionControlEngine`. O loop o impede de ser visualizado no frontend.

==========================================================
9. LOCAL EXATO ONDE OCORRE O LOOP
==========================================================
Arquivo: `pwa-terminal/src/components/OperatorConsole.tsx`
Linhas: 39-43 (useEffect com dependências vazias `[]`) e 96-98 (if (!hasInitialLoad) { setShowResumePrompt(true) }).
Devido ao "Stale Closure", o callback dentro do `setInterval` sempre enxerga `hasInitialLoad` como `false` e religa a exibição do prompt do modal a cada 1.5 segundos.

==========================================================
10. CAUSA RAIZ COMPROVADA
==========================================================
Existem DUAS causas raízes operando simultaneamente:
1. FRONTEND: Falha de gerenciamento de estado no React (Stale Closure). O intervalo de polling prende a variável `hasInitialLoad` no valor inicial (`false`), redesenhando o modal continuamente.
2. BACKEND: A operação de "Nova Sessão" (Reset Startup) apenas apaga os dados do assistente de configuração (StartupWizard) mas falha gravemente ao NÃO encerrar a sessão em andamento (`SessionControlEngine.finishSession()`), deixando o sistema inconsistente (Wizard resetado, mas Sessão ainda ativa).

==========================================================
11. EVIDÊNCIAS
==========================================================
- `OperatorConsole.tsx`: 
  ```tsx
  useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 1500); // Closure armazena hasInitialLoad=false
      return () => clearInterval(interval);
  }, []); // <-- Causa do Stale Closure
  ```
- `OperatorController.ts`:
  ```typescript
  public resetStartup = (_req: Request, res: Response) => {
      this.runtime.sessionStartupWizard.reset(); // Não finaliza a sessão no SessionControlEngine
      res.status(200).json({ status: this.runtime.sessionStartupReportService.getStartupStatus() });
  }
  ```
- `SessionControlEngine.ts`: Ausência total de qualquer método de retomada explícita (`resumeSession`).

==========================================================
12. PROPOSTA DE CORREÇÃO ARQUITETURAL MÍNIMA
==========================================================
Frontend:
- Substituir o uso direto da variável de estado por uma "ref" (ex: `hasInitialLoadRef.current = true`) ou repensar o loop de polling encapsulando corretamente as dependências, de forma a impedir que o closure engesse o valor em `false`.

Backend:
- Atualizar o método `resetStartup` no `OperatorController.ts` para garantir que `this.runtime.sessionControlEngine.finishSession('NEW_SESSION_REQUESTED')` seja chamado quando o operador solicitar uma nova sessão, limpando definitivamente o estado no backend.
