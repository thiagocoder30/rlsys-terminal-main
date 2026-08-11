import { IQuantitativeEngine } from '../../contracts/IQuantitativeEngine';
import { IVixEngine } from '../../contracts/IVixEngine';
import { QuantitativeInput } from '../common/QuantitativeInput';
import { QuantitativeOutput } from '../common/QuantitativeOutput';
import { DecisionContext } from '../DecisionContext';
import { OperationalVixCalculator } from './OperationalVixCalculator';
import { EngineExecutionMetadata } from '../common/EngineExecutionMetadata';
import { IProbabilityEngine } from '../../contracts/IProbabilityEngine';
import { IEntropyEngine } from '../../contracts/IEntropyEngine';

export class OperationalVixEngine implements IQuantitativeEngine, IVixEngine {
  public readonly engineName = 'OperationalVixEngine';
  private calculator = new OperationalVixCalculator();

  constructor(
    private readonly markovEngine: IProbabilityEngine,
    private readonly shannonEngine: IEntropyEngine
  ) {}

  public execute(input: QuantitativeInput): QuantitativeOutput {
    const startTime = Date.now();
    let score = 0;
    let confidence = 0;
    let diagnostics: Record<string, unknown> = {};
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let messages: string[] = [];

    try {
      if (!Array.isArray(input.recentSpins) || input.recentSpins.length === 0) {
        throw new Error('INSUFFICIENT_DATA: Sequence is empty or invalid.');
      }

      // We need to convert QuantitativeInput to DecisionContext to use the injected engines
      const context: DecisionContext = {
        sessionId: input.sessionId,
        timestamp: input.timestamp,
        recentHistory: input.recentSpins,
        activeStrategies: []
      };

      // Extract probabilities from Markov
      const probData = this.markovEngine.calculateProbabilities(context);
      let markovProbabilities: number[] = [];
      
      if (probData.mostProbableNextStates && Array.isArray(probData.mostProbableNextStates)) {
        markovProbabilities = probData.mostProbableNextStates.map((s: { probability: number }) => s.probability || 0);
      }

      if (probData.error) {
         messages.push(`Markov Error: ${probData.error}`);
      }

      // Extract entropy from Shannon
      const entropy = this.shannonEngine.calculateEntropy(context);
      const maxEntropy = Math.log2(37); // Theoretical max for 37 states
      let normalizedEntropy = 0;
      if (maxEntropy > 0 && entropy > 0) {
        normalizedEntropy = Math.min(1, entropy / maxEntropy);
      }

      const sampleSize = input.recentSpins.length;
      const entropyConfidence = Math.min(1, sampleSize / 37);

      const result = this.calculator.calculate(
        normalizedEntropy,
        entropyConfidence,
        markovProbabilities,
        sampleSize
      );

      score = result.vixScore;
      confidence = entropyConfidence;

      diagnostics = {
        vixScore: result.vixScore,
        marketRegime: result.marketRegime,
        riskLevel: result.riskLevel,
        entropyContribution: normalizedEntropy,
        markovContribution: markovProbabilities,
        confidence: entropyConfidence,
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
      algorithmName: 'Operational VIX',
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

  public calculateVix(context: DecisionContext): number {
    try {
      const probData = this.markovEngine.calculateProbabilities(context);
      let markovProbabilities: number[] = [];
      if (probData.mostProbableNextStates && Array.isArray(probData.mostProbableNextStates)) {
        markovProbabilities = probData.mostProbableNextStates.map((s: { probability: number }) => s.probability || 0);
      }

      const entropy = this.shannonEngine.calculateEntropy(context);
      const maxEntropy = Math.log2(37);
      let normalizedEntropy = 0;
      if (maxEntropy > 0 && entropy > 0) {
        normalizedEntropy = Math.min(1, entropy / maxEntropy);
      }
      
      const sampleSize = Array.isArray(context.recentHistory) ? context.recentHistory.length : 0;
      const entropyConfidence = Math.min(1, sampleSize / 37);
      
      const result = this.calculator.calculate(
        normalizedEntropy,
        entropyConfidence,
        markovProbabilities,
        sampleSize
      );
      return result.vixScore;
    } catch (e) {
      return 50; // Fallback VIX
    }
  }
}
