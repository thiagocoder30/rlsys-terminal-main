import { ConfigurationEngine } from './ConfigurationEngine';
import { ConfigurationHistory } from './ConfigurationHistory';
import { OperationalConfiguration } from './OperationalConfiguration';
import { ConfigurationSnapshot } from './ConfigurationSnapshot';

export class ConfigurationReportService {
    constructor(
        private readonly engine: ConfigurationEngine,
        private readonly history: ConfigurationHistory
    ) {}

    public getCurrentConfiguration(): OperationalConfiguration {
        return this.engine.getCurrentConfiguration();
    }

    public getConfigurationHistory(): readonly ConfigurationSnapshot[] {
        return this.history.getSnapshots();
    }
}
