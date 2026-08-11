import { Request, Response } from 'express';
import { RuntimeDiagnostics } from '../../../../application/runtime/observability/RuntimeDiagnostics';
import { RuntimePerformanceMonitor } from '../../../../application/runtime/observability/RuntimePerformanceMonitor';

export class DiagnosticsController {
    constructor(
        private readonly diagnostics: RuntimeDiagnostics,
        private readonly performanceMonitor: RuntimePerformanceMonitor
    ) {}

    public getDiagnostics = (req: Request, res: Response) => {
        res.json(this.diagnostics.getDiagnostics());
    }

    public getPerformance = (req: Request, res: Response) => {
        res.json(this.performanceMonitor.getPerformanceReport());
    }
}
