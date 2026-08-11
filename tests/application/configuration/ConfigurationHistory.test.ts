import { describe, it, expect } from 'vitest';
import { OperationalConfiguration } from '../../../src/application/configuration/OperationalConfiguration';
import { ConfigurationSnapshot } from '../../../src/application/configuration/ConfigurationSnapshot';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';

describe('ConfigurationHistory', () => {
    it('deve armazenar snapshots e limitar o tamanho máximo a 100 em FIFO', () => {
        const history = new ConfigurationHistory();
        const config = OperationalConfiguration.createDefault();

        for (let i = 0; i < 110; i++) {
            history.append(new ConfigurationSnapshot(config));
        }

        const snapshots = history.getSnapshots();
        expect(snapshots.length).toBe(100);
    });
});
