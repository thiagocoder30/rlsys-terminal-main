import { Request, Response } from 'express';
import { RuntimeTelemetry } from '../../../application/runtime/RuntimeTelemetry';

export class TelemetryController {
    constructor(private telemetry: RuntimeTelemetry) {}

    public getTelemetry = (req: Request, res: Response) => {
        res.json(this.telemetry.getMetrics());
    }
}
