import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Runtime Boundary Architecture Validation', () => {
    
    it('TacticalRuntimeAdapter should not import internal core engines', () => {
        const filePath = path.resolve(__dirname, '../../src/adapters/pwa/TacticalRuntimeAdapter.ts');
        const content = fs.readFileSync(filePath, 'utf8');
        
        expect(content).not.toMatch(/MarkovProbabilityEngine/);
        expect(content).not.toMatch(/QuantitativeEnginePipeline/);
        expect(content).not.toMatch(/DecisionIntelligenceEngine/);
        expect(content).not.toMatch(/ExplainabilityCoordinator/);
    });

    it('CLIIntelligenceAdapter should not import internal core engines', () => {
        const filePath = path.resolve(__dirname, '../../src/adapters/cli/CLIIntelligenceAdapter.ts');
        const content = fs.readFileSync(filePath, 'utf8');
        
        expect(content).not.toMatch(/MarkovProbabilityEngine/);
        expect(content).not.toMatch(/QuantitativeEnginePipeline/);
        expect(content).not.toMatch(/DecisionIntelligenceEngine/);
        expect(content).not.toMatch(/ExplainabilityCoordinator/);
    });

    it('RuntimeController should not import internal core engines', () => {
        const filePath = path.resolve(__dirname, '../../src/adapters/api/RuntimeController.ts');
        const content = fs.readFileSync(filePath, 'utf8');
        
        expect(content).not.toMatch(/DecisionAuditLedger/);
        expect(content).not.toMatch(/ExplainabilityCoordinator/);
        expect(content).not.toMatch(/MarkovProbabilityEngine/);
        expect(content).not.toMatch(/QuantitativeEnginePipeline/);
    });

    it('IntelligenceRuntime should be in src/runtime', () => {
        const exists = fs.existsSync(path.resolve(__dirname, '../../src/runtime/IntelligenceRuntime.ts'));
        expect(exists).toBe(true);
    });
});
