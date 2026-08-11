const fs = require('fs');
const content = fs.readFileSync('src/infrastructure/http/controllers/OperatorController.ts', 'utf8');

const regex = /public getEvolution = \(\w+: Request, \w+: Response\) => {[\s\S]*?$/;
const replacement = `public getEvolution = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.evolutionService.getEvolutionSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getEvolutionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.evolutionService.getEvolutionHistory(sessionId);
        res.status(200).json(history);
    }

    public getStrategyEvolution = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.evolutionGovernanceService.getStrategyEvolution(sessionId);
        res.status(200).json(snapshot);
    }

    public getStrategyEvolutionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.evolutionGovernanceService.getStrategyEvolutionHistory(sessionId);
        res.status(200).json(history);
    }

    public getLearningHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.learningService.getLearningHistory(sessionId);
        res.status(200).json(history);
    }

    public executeCommand = async (req: Request, res: Response) => {
        try {
            const { command, sessionId } = req.body;
            if (!command) return res.status(400).json({ error: 'Command is required' });
            
            const sId = sessionId || 'SESSION-000';
            const result = await this.workflowService.handleCommand(command, sId);
            res.status(200).json(result);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    }
}
`;

fs.writeFileSync('src/infrastructure/http/controllers/OperatorController.ts', content.replace(regex, replacement));
