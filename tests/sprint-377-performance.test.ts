import * as assert from 'node:assert';
import { StrategyPerformanceEvaluator } from '../src/domain/risk/StrategyPerformanceEvaluator';

try {
    const evaluator = new StrategyPerformanceEvaluator(['SECTOR_ALPHA', 'HEDGE_BLACK_COL3']);
    
    // Estado inicial neutro
    assert.strictEqual(evaluator.isAllowed('SECTOR_ALPHA'), true);
    assert.strictEqual(evaluator.getWeight('SECTOR_ALPHA'), 1.0);

    // Simulação de primeiro Loss (Degradação)
    evaluator.registerLoss('SECTOR_ALPHA');
    assert.strictEqual(evaluator.getWeight('SECTOR_ALPHA'), 0.6);
    assert.strictEqual(evaluator.isAllowed('SECTOR_ALPHA'), true, "Deveria permitir uma última chance no limite mínimo.");

    // Simulação de segundo Loss consecutivo (Bloqueio por Regime Hostil)
    evaluator.registerLoss('SECTOR_ALPHA');
    assert.strictEqual(evaluator.getWeight('SECTOR_ALPHA'), 0.2);
    assert.strictEqual(evaluator.isAllowed('SECTOR_ALPHA'), false, "Falha: O sistema falhou em silenciar uma estratégia com perdas acumuladas.");

    // Recuperação via Bonificação por reversão de cenário
    evaluator.registerWin('SECTOR_ALPHA');
    evaluator.registerWin('SECTOR_ALPHA');
    assert.strictEqual(evaluator.isAllowed('SECTOR_ALPHA'), true, "Falha: Sistema não recuperou a estratégia após sequência positiva.");

    console.log("✔ [TDD PASSED] Motor de Feedback e Quarentena de Sinais validado.");
} catch (e) {
    console.error("❌ FALHA CRÍTICA NOS TESTES UNITÁRIOS DA SPRINT 377:", e);
    process.exit(1);
}
