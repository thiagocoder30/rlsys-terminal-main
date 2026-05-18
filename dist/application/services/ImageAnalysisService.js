"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageAnalysisService = void 0;
class ImageAnalysisService {
    constructor(geminiAdapter) {
        this.geminiAdapter = geminiAdapter;
    }
    async analyzeImage(prompt, base64Image, mimeType) {
        // Garante que o buffer da imagem seja o primeiro argumento conforme contrato
        return await this.geminiAdapter.analyzeImage(base64Image, mimeType, prompt);
    }
}
exports.ImageAnalysisService = ImageAnalysisService;
