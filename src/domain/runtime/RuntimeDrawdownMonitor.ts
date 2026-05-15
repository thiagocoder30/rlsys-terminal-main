import { DrawdownPolicy, DrawdownStatus, MonitorResult } from './DrawdownPolicy';

export class RuntimeDrawdownMonitor {
  private readonly balances: Float64Array;
  private head: number = 0;
  private count: number = 0;
  private lastRoundId: number = -1;

  constructor(private readonly policy: DrawdownPolicy) {
    if (policy.windowSize < 2) {
      throw new Error("A janela de monitorizacao deve ter no minimo 2 rodadas.");
    }
    // Pre-alocação de memória (Evita Garbage Collection no Android)
    this.balances = new Float64Array(policy.windowSize);
  }

  /**
   * Processa uma nova rodada em tempo O(K), onde K é o tamanho da janela.
   * Utiliza padrao Result para garantir idempotencia sem quebrar o runtime.
   */
  public processRound(roundId: number, currentBankroll: number): MonitorResult {
    // 1. Idempotência: Ignorar rodadas duplicadas ou fora de ordem
    if (roundId <= this.lastRoundId) {
      return { success: false, error: 'INVALID_ROUND_SEQUENCE' };
    }

    // 2. Inserção no Buffer Circular O(1)
    this.balances[this.head] = currentBankroll;
    this.head = (this.head + 1) % this.policy.windowSize;
    if (this.count < this.policy.windowSize) {
      this.count++;
    }
    this.lastRoundId = roundId;

    // 3. Aguardar dados suficientes
    if (this.count < 2) {
      return { success: true, status: DrawdownStatus.HEALTHY };
    }

    // 4. Calcular o Pico (Peak) dentro da janela atual
    let peak = this.balances[0];
    for (let i = 1; i < this.count; i++) {
      if (this.balances[i] > peak) {
        peak = this.balances[i];
      }
    }

    // 5. Avaliar a Velocidade do Drawdown (Drawdown Velocity)
    const currentDrawdown = peak - currentBankroll;

    if (currentDrawdown >= this.policy.maxLossPerWindow) {
      return { success: true, status: DrawdownStatus.VELOCITY_ALERT };
    }

    return { success: true, status: DrawdownStatus.HEALTHY };
  }

  public reset(): void {
    this.head = 0;
    this.count = 0;
    this.lastRoundId = -1;
    this.balances.fill(0);
  }
}
