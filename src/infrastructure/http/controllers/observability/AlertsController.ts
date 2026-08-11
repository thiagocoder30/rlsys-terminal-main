import { Request, Response } from 'express';
import { RuntimeAlertManager } from '../../../../application/runtime/observability/RuntimeAlertManager';

export class AlertsController {
    constructor(private readonly alertManager: RuntimeAlertManager) {}

    public getAlerts = (req: Request, res: Response) => {
        res.json(this.alertManager.getActiveAlerts());
    }
}
