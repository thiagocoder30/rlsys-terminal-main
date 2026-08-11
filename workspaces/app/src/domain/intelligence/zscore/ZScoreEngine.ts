import { IQuantitativeEngine } from '../../contracts/IQuantitativeEngine';
import { IZScoreEngine } from '../../contracts/IZScoreEngine';
import { QuantitativeInput } from '../common/QuantitativeInput';
import { QuantitativeOutput } from '../common/QuantitativeOutput';
import { DecisionContext } from '../DecisionContext';
import { ZScoreCalculator } from './ZScoreCalculator';
import { EngineExecutionMetadata } from '../common/EngineExecutionMetadata';

export class ZScoreEngine implements IQuantitativeEngine, IZScoreEngine {
  public readonly engineName = 'ZScoreEngine';
  private calculator = new ZScoreCalculator();

  public execute(input: QuantitativeInput): QuantitativeOutput {
    const startTime = Date.now();
    let score = 0;
    let confidence = 0;
    let diagnostics: Record<string, unknown> = {};
    let metrics: Record<string, unknown> = {};
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let messages: string[] = [];

    try {
      const sequence = input.recentSpins;
      if (!Array.isArray(sequence) || sequence.length === 0) {
        throw new Error('INSUFFICIENT_DATA: Sequence is empty or invalid.');
      }

      const result = this.calculator.calculate(sequence);
      const sampleSize = sequence.filter(n => n != null && Number.isInteger(n) && n >= 0 && n <= 36).length;
      
      if (sampleSize === 0) {
        throw new Error('INSUFFICIENT_DATA: No valid spins in sequence.');
      }

      // Base confidence on sample size (e.g. 30+ is usually considered statistically significant)
      confidence = Math.min(1, sampleSize / 30);
      
      // Z-score can be positive or negative. For "score" in QuantitativeOutput (0-100),
      // we might just map the absolute z-score or keep it 0 as this engine doesn't produce an operational score directly,
      // but rather metrics.
      // We will map score based on anomaly intensity (abs(zScore)). 
      // |Z| > 3 is highly anomalous (100).
      score = Math.min(100, (Math.abs(result.zScore) / 3) * 100);

      metrics = {
        mean: result.mean,
        variance: result.variance,
        standardDeviation: result.standardDeviation,
        zScore: result.zScore,
        confidence,
        sampleSize
      };

      diagnostics = {
        ...metrics
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
      algorithmName: 'Z-Score Statistical Deviation',
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

  public calculateZScore(context: DecisionContext): number {
    try {
      if (!context.recentHistory || !Array.isArray(context.recentHistory)) return 0;
      const result = this.calculator.calculate(context.recentHistory);
      return result.zScore;
    } catch (e) {
      return 0;
    }
  }
}
