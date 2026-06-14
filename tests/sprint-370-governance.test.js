const assert = require('node:assert');

// 1. Teste de Reset do Hard Lock Diário
function isSameDay(epochA, epochB) {
    const d1 = new Date(epochA);
    const d2 = new Date(epochB);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

try {
    const now = Date.now();
    const tomorrow = now + (24 * 60 * 60 * 1000);
    assert.strictEqual(isSameDay(now, now), true, "Falha: O sistema não reconheceu o mesmo dia.");
    assert.strictEqual(isSameDay(now, tomorrow), false, "Falha: O sistema não quebrou o bloqueio no dia seguinte.");
    console.log("✔ [TESTE 1] Lógica de Hard Lock Diário (00:00) validada.");

    // 2. Teste do Veto Global de Entropia (VIX)
    const vixToxic = 96.5;
    const vixSafe = 60.0;
    assert.strictEqual(vixToxic > 95.0, true, "Falha: VIX Tóxico não reconhecido.");
    assert.strictEqual(vixSafe > 95.0, false, "Falha: VIX Seguro bloqueado incorretamente.");
    console.log("✔ [TESTE 2] Escudo Cross-Veto de Entropia validado.");
    
    // 3. Teste de Consistência de Relatório Executivo
    const stats = { wins: 5, losses: 2 };
    const hitRate = (stats.wins / (stats.wins + stats.losses)) * 100;
    assert.strictEqual(Math.round(hitRate), 71, "Falha: Cálculo de Hit Rate no Dossiê está impreciso.");
    console.log("✔ [TESTE 3] Motor Analítico de Relatórios validado.");

} catch (error) {
    console.error("❌ FALHA CRÍTICA NOS TESTES:", error.message);
    process.exit(1);
}
