"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionController = void 0;
class VisionController {
    constructor(imageAnalysisService) {
        this.imageAnalysisService = imageAnalysisService;
    }
    async handle(req, res) {
        try {
            const base64Image = req.file ? req.file.buffer.toString('base64') : req.body.image_base64;
            const mimeType = req.file ? req.file.mimetype : (req.body.image_mime_type || 'image/jpeg');
            const prompt = req.body.prompt || 'Analise esta imagem';
            if (!base64Image) {
                res.status(400).json({ message: 'No image data provided.' });
                return;
            }
            const analysis = await this.imageAnalysisService.analyze(prompt, base64Image, mimeType);
            res.status(200).json({ analysis });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
exports.VisionController = VisionController;
