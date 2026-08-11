import { IQuantitativeEngine } from '../../contracts/IQuantitativeEngine';
import { IProbabilityEngine } from '../../contracts/IProbabilityEngine';
import { QuantitativeInput } from '../common/QuantitativeInput';
import { QuantitativeOutput } from '../common/QuantitativeOutput';
import { DecisionContext } from '../DecisionContext';
import { MarkovTransitionMatrix } from './MarkovTransitionMatrix';
import { EngineExecutionMetadata } from '../common/EngineExecutionMetadata';

export class MarkovProbabilityEngine implements IQuantitativeEngine, IProbabilityEngine {
  public readonly engineName = 'MarkovProbabilityEngine';

  public execute(input: QuantitativeInput): QuantitativeOutput {
    const startTime = Date.now();
    const matrix = new MarkovTransitionMatrix();
    let score = 0;
    let confidence = 0;
    let diagnostics: Record<string, unknown> = {};
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let messages: string[] = [];

    try {
      matrix.buildFromSequence(input.recentSpins);
      
      const lastSpin = input.recentSpins[input.recentSpins.length - 1];
      const nextStates = matrix.getMostProbableNextStates(lastSpin, 3);
      
      diagnostics = {
        lastSpin,
        mostProbableNextStates: nextStates
      };

      if (nextStates.length > 0) {
        score = nextStates[0].probability * 100;
        confidence = nextStates[0].probability;
      }
    } catch (error) {
      status = 'FAILED';
      messages.push(error instanceof Error ? error.message : 'Unknown error');
      score = 0;
      confidence = 0;
    }

    const duration = Date.now() - startTime;
    const metadata: EngineExecutionMetadata = {
      durationMs: duration,
      version: '1.0.0',
      algorithmName: 'Markov Chain Transition Matrix',
      status,
      messages
    };

    return {
      engineName: this.engineName,
      score,
      confidence,
      executionTime: duration,
      metadata,
      diagnostics
    };
  }

  public calculateProbabilities(context: DecisionContext): Record<string, unknown> {
    const matrix = new MarkovTransitionMatrix();
    try {
      matrix.buildFromSequence(context.recentHistory);
      const lastSpin = context.recentHistory[context.recentHistory.length - 1];
      return {
        mostProbableNextStates: matrix.getMostProbableNextStates(lastSpin, 5)
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }
}
