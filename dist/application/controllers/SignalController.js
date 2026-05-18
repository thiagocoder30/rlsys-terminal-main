"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalController = void 0;
class SignalController {
    constructor(processSignalsUseCase) {
        this.processSignalsUseCase = processSignalsUseCase;
    }
    async handle(req, res) {
        try {
            const { values } = req.body;
            if (!Array.isArray(values)) {
                res.status(400).json({ message: 'Invalid input: "values" must be an array.' });
                return;
            }
            const result = await this.processSignalsUseCase.execute(values);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
exports.SignalController = SignalController;
