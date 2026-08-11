import { ConfigurationSnapshot } from './ConfigurationSnapshot';

export class ConfigurationHistory {
    private readonly snapshots: ConfigurationSnapshot[] = [];
    private readonly MAX_CAPACITY = 100;

    public append(snapshot: ConfigurationSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_CAPACITY) {
            this.snapshots.shift();
        }
    }

    public getSnapshots(): readonly ConfigurationSnapshot[] {
        return [...this.snapshots];
    }

    public getByHash(hash: string): ConfigurationSnapshot | undefined {
        return this.snapshots.find(s => s.hash === hash || s.configuration.hash === hash);
    }

    public getLatest(): ConfigurationSnapshot | undefined {
        if (this.snapshots.length === 0) return undefined;
        return this.snapshots[this.snapshots.length - 1];
    }
}
