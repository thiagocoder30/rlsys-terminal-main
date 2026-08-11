import { describe, it, expect } from 'vitest';
import { RuntimeController } from '../../src/infrastructure/http/controllers/RuntimeController';

describe('Ensemble Runtime Integration', () => {
    it('should have ensemble endpoints exposed via controller', () => {
        const controller = new RuntimeController();
        expect(controller.votingEngine).toBeDefined();
        expect(controller.consensusCalculator).toBeDefined();
        expect(controller.conflictAnalyzer).toBeDefined();
        expect(controller.ensembleDecisionEngine).toBeDefined();
        expect(controller.ensembleSnapshotManager).toBeDefined();
        expect(controller.consensusService).toBeDefined();
        
        expect(controller.getEnsemble).toBeDefined();
        expect(controller.getEnsembleHistory).toBeDefined();
        expect(controller.getConsensus).toBeDefined();
        expect(controller.getVotes).toBeDefined();
        expect(controller.getConflicts).toBeDefined();
    });
});
