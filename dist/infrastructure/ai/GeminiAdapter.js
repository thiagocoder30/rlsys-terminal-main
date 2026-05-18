"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAdapter = void 0;
const generative_ai_1 = require("@google/generative-ai");
class GeminiAdapter {
    constructor(apiKey) {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Usando gemini-1.5-flash para melhor performance no Helio P22
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
    async generateVisionContent(prompt, base64, mimeType) {
        try {
            const result = await this.model.generateContent([
                prompt,
                { inlineData: { data: base64, mimeType } }
            ]);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            throw new Error(`Erro na análise Gemini: ${error.message}`);
        }
    }
}
exports.GeminiAdapter = GeminiAdapter;
