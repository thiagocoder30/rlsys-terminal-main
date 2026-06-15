import * as assert from 'node:assert';
import { PositionSizingEngine } from '../src/domain/risk/PositionSizingEngine';

try {
    const sizing = new PositionSizingEngine();
    
    // Teste 1: Validação de Floor e Multiplicação na Pragmatic (Estratégia base R$ 2.50 = 25 posições)
    sizing.setProvider('PRAGMATIC');
    const resultPragmaticHostil = sizing.calculateOperationalSizing(100, 92.8, 2.50);
    assert.strictEqual(resultPragmaticHostil.finalStake, 2.50, "Falha: Sizing deveria cravar o custo base de R$ 2.50 em ambiente hostil.");
    assert.strictEqual(resultPragmaticHostil.multiplier, 1, "Falha: Multiplicador deveria ser 1x.");

    // Teste 2: Validação de Floor na Evolution (Mesma estratégia exige R$ 12.50 devido ao chip de R$ 0.50)
    sizing.setProvider('EVOLUTION');
    const resultEvolutionHostil = sizing.calculateOperationalSizing(100, 92.8, 2.50);
    assert.strictEqual(resultEvolutionHostil.finalStake, 12.50, "Falha: Sizing deveria normalizar o piso da Evolution para R$ 12.50.");
    assert.strictEqual(resultEvolutionHostil.multiplier, 5, "Falha: Multiplicador de escala da Evolution deve ser de 5x.");

    console.log("✔ [CI/TDD PASSED] Nova matemática de Unit Chip Sizing homologada com sucesso.");
} catch (e) {
    console.error("❌ FALHA CRÍTICA NOS TESTES DE INTEGRAÇÃO:", e);
    process.exit(1);
}
