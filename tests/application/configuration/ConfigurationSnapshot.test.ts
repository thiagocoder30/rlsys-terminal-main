import { describe, it, expect } from 'vitest';
import { OperationalConfiguration } from '../../../src/application/configuration/OperationalConfiguration';
import { ConfigurationSnapshot } from '../../../src/application/configuration/ConfigurationSnapshot';

describe('ConfigurationSnapshot', () => {
    it('deve criar snapshot imutável com hash SHA-256', () => {
        const config = OperationalConfiguration.createDefault();
        const snapshot = new ConfigurationSnapshot(config);

        expect(snapshot.configuration).toBe(config);
        expect(snapshot.hash).toBeDefined();
        expect(snapshot.hash.length).toBe(64);
        expect(Object.isFrozen(snapshot)).toBe(true);
    });
});
