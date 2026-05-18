"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAdapter = void 0;
class GeminiAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async analyzeImage(imageData, mimeType, prompt) {
        const base64Data = typeof imageData === 'string'
            ? imageData.replace(/^data:image\/\w+;base64,/, "")
            : imageData.toString('base64');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${this.apiKey}`;
        const payload = {
            contents: [{
                    parts: [
                        {
                            text: `SISTEMA DE EXTRAÇÃO DE DADOS CRÍTICOS - V1.7 CORE
                   1. CAPTURA ZONA A (LINHA SUPERIOR): Extraia todos os números da faixa de 'Últimos Resultados'.
                   2. CAPTURA ZONA B (GRADE): Extraia todos os números da tabela de estatísticas abaixo.
                   3. VALIDAÇÃO: Combine as zonas. Se o slider de rodapé marcar 140, o array final DEVE ter 140 itens.
                   4. SAÍDA: JSON puro, sem markdown: {"total": number, "sequencia": [number]}`
                        },
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                    ]
                }],
            generationConfig: {
                temperature: 0.0,
                topP: 0.1
            }
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error?.message || "Erro API");
        const text = data.candidates[0].content.parts[0].text;
        return text.replace(/```json/g, "").replace(/```/g, "").trim();
    }
}
exports.GeminiAdapter = GeminiAdapter;
