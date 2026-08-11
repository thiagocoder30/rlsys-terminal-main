import { Request, Response } from 'express';
import { RuntimeSessionManager } from '../../../application/runtime/RuntimeSessionManager';
import { RuntimeTelemetry } from '../../../application/runtime/RuntimeTelemetry';

export class HealthController {
    constructor(
        private sessionManager: RuntimeSessionManager,
        private telemetry: RuntimeTelemetry
    ) {}

    public health = (req: Request, res: Response) => {
        res.json({ status: 'UP' });
    }

    public runtime = (req: Request, res: Response) => {
        res.json({ status: 'UP', service: 'IntelligenceRuntime' });
    }

    public version = (req: Request, res: Response) => {
        res.json({ version: '5.0.0' });
    }

    public status = (req: Request, res: Response) => {
        res.json({ status: 'OPERATIONAL' });
    }

    public session = (req: Request, res: Response) => {
        res.json({ activeSessions: this.sessionManager.getActiveSessionsCount() });
    }

    public getTelemetry = (req: Request, res: Response) => {
        res.json(this.telemetry.getMetrics());
    }
}
