import { IQuantitativeEngine } from '../../contracts/IQuantitativeEngine';
import { IEntropyEngine } from '../../contracts/IEntropyEngine';
import { QuantitativeInput } from '../common/QuantitativeInput';
import { QuantitativeOutput } from '../common/QuantitativeOutput';
import { DecisionContext } from '../DecisionContext';
import { ShannonEntropyCalculator } from './ShannonEntropyCalculator';
import { EngineExecutionMetadata } from '../common/EngineExecutionMetadata';

export class ShannonEntropyEngine implements IQuantitativeEngine, IEntropyEngine {
  public readonly engineName = 'ShannonEntropyEngine';
  private calculator = new ShannonEntropyCalculator();

  public execute(input: QuantitativeInput): QuantitativeOutput {
    const startTime = Date.now();
    let score = 0;
    let confidence = 0;
    let diagnostics: Record<string, unknown> = {};
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let messages: string[] = [];
    
    try {
      const sequence = input.recentSpins;
      if (!Array.isArray(sequence) || sequence.length === 0) {
        throw new Error('INSUFFICIENT_DATA: Sequence is empty or invalid.');
      }

      // Check valid length after filtering
      const validStates = this.calculator.getObservedStates(sequence);
      if (validStates.length === 0) {
        throw new Error('INSUFFICIENT_DATA: No valid spins in sequence.');
      }

      const entropy = this.calculator.calculateEntropy(sequence);
      const normalizedEntropy = this.calculator.calculateNormalizedEntropy(sequence);
      const maxEntropy = this.calculator.calculateMaxEntropy();
      const observedStates = validStates;
      const sampleSize = sequence.length;
      const frequencies = this.calculator.calculateFrequencies(sequence);
      
      const distribution = Array.from(frequencies.entries()).map(([state, count]) => ({ state, count }));
      
      score = normalizedEntropy * 100;
      
      // Basic confidence measure: how many states have been observed relative to total possible.
      confidence = Math.min(1, sampleSize / 37);

      diagnostics = {
        entropy,
        normalizedEntropy,
        maxEntropy,
        observedStates,
        distribution,
        sampleSize
      };
      
    } catch (error) {
      status = 'FAILED';
      messages.push(error instanceof Error ? error.message : 'Unknown error');
      score = 0;
      confidence = 0;
    }

    const durationMs = Date.now() - startTime;
    
    const metadata: EngineExecutionMetadata = {
      durationMs,
      version: '1.0.0',
      algorithmName: 'Shannon Entropy',
      status,
      messages
    };

    return {
      engineName: this.engineName,
      score,
      confidence,
      executionTime: durationMs,
      metadata,
      diagnostics
    };
  }

  public calculateEntropy(context: DecisionContext): number {
    try {
      if (!context.recentHistory || !Array.isArray(context.recentHistory)) return 0;
      return this.calculator.calculateEntropy(context.recentHistory);
    } catch (e) {
      return 0;
    }
  }
}
