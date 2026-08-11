import { createHash } from 'crypto';
import { OperationalConfiguration } from './OperationalConfiguration';

export class ConfigurationSnapshot {
    public readonly configuration: OperationalConfiguration;
    public readonly timestamp: number;
    public readonly version: string;
    public readonly hash: string;

    constructor(configuration: OperationalConfiguration) {
        this.configuration = configuration;
        this.timestamp = Date.now();
        this.version = configuration.version;
        this.hash = this.calculateHash();
        Object.freeze(this);
    }

    private calculateHash(): string {
        const payload = JSON.stringify({
            configHash: this.configuration.hash,
            timestamp: this.timestamp,
            version: this.version
        });

        return createHash('sha256').update(payload).digest('hex');
    }
}
