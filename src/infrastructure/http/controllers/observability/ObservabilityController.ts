import { Request, Response } from 'express';
import { RuntimeMetricsCollector } from '../../../../application/runtime/observability/RuntimeMetricsCollector';
import { ObservabilityEventBus } from '../../../../application/runtime/observability/ObservabilityEventBus';
import { RuntimeDiagnostics } from '../../../../application/runtime/observability/RuntimeDiagnostics';
import { RuntimePerformanceMonitor } from '../../../../application/runtime/observability/RuntimePerformanceMonitor';
import { RuntimeAlertManager } from '../../../../application/runtime/observability/RuntimeAlertManager';

export class ObservabilityController {
    constructor(
        private readonly metricsCollector: RuntimeMetricsCollector,
        private readonly eventBus: ObservabilityEventBus,
        private readonly diagnostics: RuntimeDiagnostics,
        private readonly performanceMonitor: RuntimePerformanceMonitor,
        private readonly alertManager: RuntimeAlertManager
    ) {}

    public getMetrics = (req: Request, res: Response) => {
        res.json(this.metricsCollector.getMetrics());
    }

    public getEvents = (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
        res.json(this.eventBus.getEvents(limit));
    }

    public getDiagnostics = (req: Request, res: Response) => {
        res.json(this.diagnostics.getDiagnostics());
    }

    public getPerformance = (req: Request, res: Response) => {
        res.json(this.performanceMonitor.getPerformanceReport());
    }

    public getAlerts = (req: Request, res: Response) => {
        res.json(this.alertManager.getActiveAlerts());
    }
}
