import * as assert from 'node:assert';
import { PositionSizingEngine } from '../src/domain/risk/PositionSizingEngine';
import { TrailingStopGuard } from '../src/domain/risk/TrailingStopGuard';

try {
    const sizing = new PositionSizingEngine();
    
    // Teste 1: Regras Físicas de Provedor (Floor Limit)
    sizing.setProvider('PRAGMATIC');
    assert.strictEqual(sizing.getProvider(), 'PRAGMATIC');
    assert.strictEqual(sizing.calculateStake(100, 96), 0.10, "Falha: Floor da Pragmatic não respeitado no Caos.");
    
    sizing.setProvider('EVOLUTION');
    assert.strictEqual(sizing.calculateStake(100, 96), 0.50, "Falha: Floor da Evolution não respeitado no Caos.");
    
    // Teste 2: Alavancagem Estocástica (Fractional Kelly)
    const lowVixStake = sizing.calculateStake(100, 50);
    assert.ok(lowVixStake >= 0.50, "Falha: Algoritmo não alavancou em cenário de baixa Entropia.");

    // Teste 3: Armadilha de Trailing Stop
    const stopGuard = new TrailingStopGuard(100);
    assert.strictEqual(stopGuard.checkStop(100).isStopped, false);
    
    stopGuard.updatePeak(106); // Simula pico de +6% (Escudo Armado)
    assert.strictEqual(stopGuard.checkStop(106).isStopped, false);
    
    // Simula queda de 2% a partir do pico (106 * 0.98 = 103.88)
    assert.strictEqual(stopGuard.checkStop(103.80).isStopped, true, "Falha Crítica: Trailing Stop não foi engatilhado na reversão.");

    console.log("✔ [TESTE SIZING] Fração Kelly e Limites de Provedor auditados.");
    console.log("✔ [TESTE TRAILING] Ativação e recuo do Escudo Móvel validados.");
} catch (e) {
    console.error("❌ FALHA CRÍTICA NOS TESTES INTERNOS:", e);
    process.exit(1);
}
