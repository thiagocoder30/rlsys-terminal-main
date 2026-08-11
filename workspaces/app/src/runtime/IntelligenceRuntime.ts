import crypto from 'crypto';
import { QuantitativeEnginePipeline } from '../application/intelligence/QuantitativeEnginePipeline';
import { IDecisionIntelligenceEngine } from '../domain/contracts/IDecisionIntelligenceEngine';
import { ExplainabilityCoordinator } from '../application/intelligence/ExplainabilityCoordinator';
import { IDecisionAuditLedger } from '../domain/contracts/IDecisionAuditLedger';
import { QuantitativeInput } from '../domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionContext } from './context/IntelligenceExecutionContext';
import { IntelligenceExecutionResult } from './result/IntelligenceExecutionResult';
import { DecisionContext } from '../domain/intelligence/DecisionContext';

import { IntelligenceRuntimePort } from './contracts/IntelligenceRuntimePort';

export class IntelligenceRuntime implements IntelligenceRuntimePort {
  constructor(
    private readonly pipeline: QuantitativeEnginePipeline,
    private readonly decisionEngine: IDecisionIntelligenceEngine,
    private readonly explainabilityCoordinator: ExplainabilityCoordinator,
    private readonly auditLedger: IDecisionAuditLedger
  ) {}

  public execute(input: QuantitativeInput): IntelligenceExecutionResult {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const context: IntelligenceExecutionContext = {
      executionId,
      timestamp,
      input,
      runtimeMetadata: { version: '1.0.0', runner: 'IntelligenceRuntime' },
      correlationId: input.sessionId
    };

    // 1. QuantitativeEnginePipeline
    const pipelineResults = this.pipeline.executeAll(input);

    // 2. DecisionIntelligenceEngine
    const decisionContext: DecisionContext = {
      sessionId: input.sessionId,
      timestamp: input.timestamp,
      recentHistory: input.recentSpins,
      activeStrategies: Array.isArray(input.executionParameters?.activeStrategies)
        ? (input.executionParameters.activeStrategies as string[])
        : []
    };
    
    const summary = this.decisionEngine.analyze(decisionContext);

    // 3. ExplainabilityCoordinator
    const explanation = this.explainabilityCoordinator.explain(summary);

    // 4. DecisionAuditLedger
    this.auditLedger.append({
      eventId: executionId,
      timestamp,
      decision: 'INTELLIGENCE_PIPELINE_EXECUTED',
      reason: 'Automated orchestration of quantitative engines and explainability completed.',
      sessionId: input.sessionId
    });

    const durationMs = Date.now() - startTime;
    
    let runtimeStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
    if (summary.processingMetadata.status === 'FAILED' || explanation.processingMetadata.status === 'FAILED') {
      runtimeStatus = 'FAILED';
    } else if (summary.processingMetadata.status === 'PARTIAL' || explanation.processingMetadata.status === 'PARTIAL') {
      runtimeStatus = 'PARTIAL';
    }

    return {
      summary,
      explanation,
      executionMetadata: {
        executionId,
        correlationId: context.correlationId,
        enginesExecuted: pipelineResults.length
      },
      processingTime: durationMs,
      runtimeStatus,
      diagnostics: {
        pipelineResults,
        durationMs,
        executionId
      }
    };
  }
}
