import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationEngine } from '../../../src/application/configuration/ConfigurationEngine';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';
import { ConfigurationReportService } from '../../../src/application/configuration/ConfigurationReportService';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('ConfigurationReportService', () => {
    let history: ConfigurationHistory;
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let engine: ConfigurationEngine;
    let reportService: ConfigurationReportService;

    beforeEach(() => {
        history = new ConfigurationHistory();
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger();
        engine = new ConfigurationEngine(history, eventBus, ledger);
        reportService = new ConfigurationReportService(engine, history);
    });

    it('deve fornecer a configuração atual e o histórico de snapshots', () => {
        const current = reportService.getCurrentConfiguration();
        expect(current.provider).toBe('PRAGMATIC');

        const hist = reportService.getConfigurationHistory();
        expect(hist.length).toBe(1);
    });
});
