import { describe, it, expect } from 'vitest';
import { RuntimeController } from '../../src/infrastructure/http/controllers/RuntimeController';

describe('Adaptive Runtime Integration', () => {
    it('should initialize Adaptive components inside RuntimeController', () => {
        const controller = new RuntimeController();
        expect(controller.adaptiveEngine).toBeDefined();
        expect(controller.adaptiveOrchestrator).toBeDefined();
        expect(controller.performanceHistory).toBeDefined();
        expect(controller.confidenceRepo).toBeDefined();
    });
});
