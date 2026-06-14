'use strict';

/**
 * Rastreador de Mesa O(1) e O(N log N) para Heatmap.
 * Responsável por gerar métricas on-demand sem travar a thread principal.
 */
class LiveMesaTracker {
  constructor() {
    this.history = [];
    this.frequencies = new Map();
    for (let i = 0; i <= 36; i++) {
      this.frequencies.set(i, 0);
    }
  }

  addNumber(num) {
    this.history.push(num);
    this.frequencies.set(num, this.frequencies.get(num) + 1);
  }

  getTimeline(limit = 15) {
    if (this.history.length === 0) return 'Mesa sem histórico recente.';
    
    // Inverte a ordem do array (slice) para que o giro mais recente fique no índice 0.
    // Utiliza ' « ' para indicar visualmente que os números da direita são mais antigos.
    return this.history.slice(-limit).reverse().join(' « ');
  }

  getHeatmap() {
    const sorted = [...this.frequencies.entries()].sort((a, b) => b[1] - a[1]);
    
    const hot = sorted.slice(0, 5).filter(n => n[1] > 0).map(n => `${n[0]} (${n[1]}x)`);
    const cold = sorted.slice(-5).map(n => `${n[0]} (${n[1]}x)`);

    return {
      hot: hot.length ? hot.join(' | ') : 'Dados insuficientes',
      cold: cold.length ? cold.join(' | ') : 'Dados insuficientes',
      totalSpins: this.history.length
    };
  }
}

module.exports = { LiveMesaTracker };
