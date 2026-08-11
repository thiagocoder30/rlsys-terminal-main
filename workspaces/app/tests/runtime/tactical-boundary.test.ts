import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tactical Boundary Architecture Validation', () => {

    const checkNoDirectImports = (dirPath: string) => {
        if (!fs.existsSync(dirPath)) return;

        const checkDirectory = (currentPath: string) => {
            const files = fs.readdirSync(currentPath);
            for (const file of files) {
                const fullPath = path.join(currentPath, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    checkDirectory(fullPath);
                } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    
                    expect(content).not.toMatch(/MarkovProbabilityEngine/);
                    expect(content).not.toMatch(/QuantitativeEnginePipeline/);
                    expect(content).not.toMatch(/DecisionIntelligenceEngine/);
                    expect(content).not.toMatch(/StrategyRankingEngine/);
                    expect(content).not.toMatch(/ExplainabilityCoordinator/);
                }
            }
        };

        checkDirectory(dirPath);
    };

    it('Adapters layer should not import internal core engines', () => {
        const adaptersPath = path.resolve(__dirname, '../../src/adapters');
        checkNoDirectImports(adaptersPath);
    });

    it('PWA terminal should not import internal core engines', () => {
        const pwaPath = path.resolve(__dirname, '../../pwa-terminal');
        checkNoDirectImports(pwaPath);
    });

});
