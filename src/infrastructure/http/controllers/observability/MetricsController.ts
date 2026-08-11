import { Request, Response } from 'express';
import { RuntimeMetricsCollector } from '../../../../application/runtime/observability/RuntimeMetricsCollector';
import { ObservabilityEventBus } from '../../../../application/runtime/observability/ObservabilityEventBus';

export class MetricsController {
    constructor(
        private readonly metricsCollector: RuntimeMetricsCollector,
        private readonly eventBus: ObservabilityEventBus
    ) {}

    public getMetrics = (req: Request, res: Response) => {
        res.json(this.metricsCollector.getMetrics());
    }

    public getEvents = (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
        res.json(this.eventBus.getEvents(limit));
    }
}
