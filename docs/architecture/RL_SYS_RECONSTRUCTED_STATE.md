# RL.SYS CORE - CONTEXT RECONSTRUCTION ENGINE

---

## 1. SYSTEM RECONSTRUCTION STATUS

Coherence Score:
46 / 100

Context Status:
MEDIUM_FIDELITY_CONTEXT

---

## 2. EXTRACTED STATE SIGNALS

## 1. SYSTEM STATE

```
{
  "system": "RL.SYS CORE",
  "lastSprint": "R0-L",
  "status": {
    "R0-D": "OK",
    "R0-E": "OK",
    "R0-F": "OK",
    "R0-G": "OK",
    "R0-H": "OK",
    "R0-I": "OK",
    "R0-J": "OK",
    "R0-K": "OK",
    "R0-L": "OK"
  },
  "lastReport": "docs/architecture/RUNTIME_LIVE_PROXY_INJECTOR_REPORT.md",
  "lastLogDir": "/sdcard/Download/RL_SYS/sprint_logs",
  "architectureMode": "STATIC_MODELING_WITH_PROXY_DESIGN",
  "memoryModel": "STATE_MANIFEST_BASED_BOOTSTRAP",
  "nextSuggestedSprint": "R0-N"
}
```

---

## 2. ARCHITECTURE TOPOLOGY

---

## 3. ARCHITECTURE TOPOLOGY SNAPSHOT

## 2. ARCHITECTURE TOPOLOGY

```
# RUNTIME TOPOLOGY

Generated: Tue Jun 23 21:22:32 -03 2026

## Critical Components

- PaperTestOperatorConsole
- LivePaperOrchestrator
- paper-operational-cli-mode-engine
- StrategyDecisionEngine

## Runtime Flow

PaperTestOperatorConsole
  -> LivePaperOrchestrator
     -> Analytics Engines
     -> Ledger
     -> Runtime Enforcement

paper-operational-cli-mode-engine
  -> Session Engines
  -> Risk Engines
  -> Bankroll Engines

StrategyDecisionEngine
  -> Decision Logic
```

---

## 3. DOMAIN MAP

---

## 4. DOMAIN STRUCTURE SIGNALS

## 3. DOMAIN MAP

```
# DOMAIN MAP

Generated: Tue Jun 23 21:10:16 -03 2026

src/domain/adaptive-confidence/adaptive-confidence-calibration-engine.ts
src/domain/analytics/EVRiskAnalyticsEngine.ts
src/domain/analytics/FusionReducedDoctrineEngine.ts
src/domain/analytics/LiveMesaTracker.ts
src/domain/analytics/TriplicacaoAdvancedProbabilityEngine.ts
src/domain/analytics/TriplicacaoPatternEngine.ts
src/domain/analytics/WheelHeatmapAnalyticsEngine.ts
src/domain/authorization/AuthorizationExplainabilityEngine.js
src/domain/authorization/InstitutionalAuthorizationEngine.js
src/domain/backtesting/AdvancedWalkForwardValidator.ts
src/domain/backtesting/InstitutionalBacktestEngine.ts
src/domain/bankroll/DailyLossGuardEngine.js
src/domain/bankroll/MonthlyDrawdownGuardEngine.js
src/domain/bankroll/paper-bankroll-account-engine.ts
src/domain/bankroll/paper-operational-cli-mode-engine.ts
src/domain/bankroll/paper-risk-guard-aggregator.ts
src/domain/bankroll/paper-session-coordinator.ts
src/domain/bankroll/paper-session-journal-engine.ts
src/domain/bankroll/paper-session-recovery-engine.ts
src/domain/bankroll/paper-session-snapshot-engine.ts
src/domain/bankroll/paper-settlement-engine.ts
src/domain/bankroll/paper-stake-policy-engine.ts
src/domain/bankroll/paper-trade-lifecycle-engine.ts
src/domain/bankroll/session-time/index.ts
src/domain/bankroll/session-time/session-time-guard.ts
src/domain/benchmark/StrategyBenchmarkEngine.ts
src/domain/certification/final-paper-certification-report/final-paper-certification-report-engine.ts
src/domain/certification/final-paper-certification-report/index.ts
src/domain/certification/multi-session/index.ts
src/domain/certification/multi-session/multi-session-certification-engine.ts
src/domain/certification/paper-runtime/index.ts
src/domain/certification/paper-runtime/paper-runtime-certification-harness.ts
src/domain/certification/paper-stability-stress-test/index.ts
src/domain/certification/paper-stability-stress-test/paper-stability-stress-test-engine.ts
src/domain/certification/threshold-calibration/index.ts
src/domain/certification/threshold-calibration/institutional-threshold-calibration-engine.ts
src/domain/comparison/StrategyComparisonFramework.ts
src/domain/confidence/AdaptiveConfidenceEngine.ts
src/domain/context-similarity/context-similarity-engine.ts
src/domain/datasets/DatasetRegistryEngine.ts
src/domain/decision/DecisionContracts.ts
src/domain/decision/DecisionLookupEngine.ts
src/domain/decision/DecisionOrchestrator.ts
src/domain/decision/InstitutionalStrategyAllocationEngine.ts
src/domain/decision/PhysicsTacticalEngine.ts
src/domain/decision/StrategyDecisionEngine.ts
src/domain/enforcement/RuntimeEnforcementOrchestrator.ts
src/domain/entities/Signal.ts
src/domain/events/InternalEventBus.ts
src/domain/explainability/ExplainabilityEngine.ts
src/domain/finance/PositionSizingEngine.ts
src/domain/financial/AutoSettlementEngine.js
src/domain/financial/AutoSettlementEngine.ts
src/domain/financial/strategies/CrossGridHedgeStrategy.ts
src/domain/institutional-audit-timeline/institutional-audit-timeline-engine.ts
src/domain/institutional-decision-trace/institutional-decision-trace-engine.ts
src/domain/institutional-event-ledger/institutional-event-ledger-engine.ts
src/domain/institutional-explainability/institutional-explainability-engine.ts
src/domain/institutional-hud-summary/institutional-hud-summary-engine.ts
src/domain/institutional-knowledge-graph/institutional-knowledge-graph-engine.ts
src/domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.ts
src/domain/institutional-readiness-review-v2/institutional-readiness-review-v2.ts
src/domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge.ts
src/domain/institutional-recommendation/institutional-recommendation-engine.ts
src/domain/intelligence/DecayCompensationFilter.ts
src/domain/intelligence/RegimeConvergenceEngine.ts
src/domain/interfaces/IAnalyticsEngine.ts
src/domain/interfaces/IBankrollRepository.ts
src/domain/interfaces/IGeminiAdapter.ts
src/domain/interfaces/IHistoryBuffer.ts
src/domain/interfaces/IImageAnalysisService.ts
src/domain/journal/RuntimeSessionJournalContracts.ts
src/domain/knowledge/CompilerContracts.ts
src/domain/knowledge/InstitutionalKnowledgeGraphCoreEngine.js
src/domain/knowledge/KnowledgeCompiler.ts
src/domain/knowledge/SnapshotSchema.ts
src/domain/knowledge/SnapshotValidator.ts
src/domain/learning-confidence-validation/learning-confidence-validation-engine.ts
src/domain/learning-memory/learning-memory-layer.ts
src/domain/learning-weight-adjustment/learning-weight-adjustment-engine.ts
src/domain/learning/ContextSimilarityEngineV2.js
src/domain/learning/InstitutionalLearningGovernanceSnapshotEngine.js
src/domain/learning/LearningWeightAdjustmentEngine.js
src/domain/learning/OutcomeCorrelationEngine.js
src/domain/ledger/PaperLedgerContracts.ts
src/domain/ledger/PaperLedgerEngine.ts
src/domain/ledger/PaperTradingLedger.ts
src/domain/math/HistoryBuffer.ts
src/domain/math/ISignalRepository.ts
src/domain/memory/SignalObjectPool.ts
src/domain/memory/adaptive-supervision-intelligence-engine.ts
src/domain/memory/contextual-failure-prediction-engine.ts
src/domain/memory/institutional-trust-score-engine.ts
src/domain/memory/operator-behavioral-fingerprint-engine.ts
src/domain/memory/session-pattern-memory-engine.ts
src/domain/multi-session-analytics/multi-session-analytics-engine.ts
src/domain/ocr/OcrEvidenceQualityScoringEngine.js
src/domain/ocr/OcrEvidenceQuarantineGate.js
src/domain/ocr/OcrReliabilityContracts.ts
src/domain/ocr/OcrReliabilityMesh.ts
src/domain/ocr/index.ts
src/domain/operator/OperatorGuidanceMessage.ts
src/domain/operator/OperatorHudContracts.ts
src/domain/operator/OperatorHudFormatter.ts
src/domain/operator/OperatorHudProjectionEngine.ts
src/domain/operator/index.ts
src/domain/outcome-correlation/outcome-correlation-engine.ts
src/domain/performance/RuntimePerformanceBudgetEngine.ts
src/domain/persistence/EdgePersistenceAnalyzer.ts
src/domain/recommendation/InstitutionalRecommendationEngineV2.js
src/domain/recommendation/InstitutionalRecommendationGovernanceEngine.js
src/domain/recommendation/RecommendationExplainabilityEngine.js
src/domain/regime/RegimeClassificationEngine.ts
src/domain/replay/DeterministicReplayStudio.ts
src/domain/replay/ReplayPersistenceContracts.ts
src/domain/replay/SessionReplayContracts.ts
src/domain/replay/SessionReplayStudio.ts
src/domain/reporting/PaperTradingReportExporter.ts
src/domain/reporting/index.ts
src/domain/research/BoundedSpinBuffer.ts
src/domain/research/DataIntegrityValidator.ts
src/domain/research/DatasetEngine.ts
src/domain/research/DealerBiasAnalyzer.ts
src/domain/research/DealerSignatureEngine.ts
src/domain/research/MonteCarloResearchStudio.ts
src/domain/research/MultiDealerAggregator.ts
src/domain/research/OfflineResearchRunner.ts
src/domain/research/ResearchExperimentOrchestrator.ts
src/domain/research/SelfLearningEngine.ts
src/domain/research/SpatialClusterCorrelationEngine.ts
src/domain/research/SyntheticSessionGenerator.ts
src/domain/research/WheelTopology.ts
src/domain/risk/BankrollSafetyGate.ts
src/domain/risk/CapitalExposureSimulator.ts
src/domain/risk/ConsciousProfitModeEngine.ts
src/domain/risk/DynamicEmotionalCooldownGuard.js
src/domain/risk/DynamicEmotionalCooldownGuard.ts
src/domain/risk/EmotionalCooldownGuard.ts
src/domain/risk/OperatorRiskProfile.ts
src/domain/risk/PositionSizingEngine.ts
src/domain/risk/RiskProfileRepository.ts
src/domain/risk/StrategyPerformanceEvaluator.ts
src/domain/risk/StressScenarioAnalyzer.ts
src/domain/risk/TrailingStopGuard.ts
src/domain/risk/index.ts
src/domain/runtime/CooldownContracts.ts
src/domain/runtime/DrawdownPolicy.ts
src/domain/runtime/EmergencyCapitalFreeze.ts
src/domain/runtime/EmergencyFreezeGuard.ts
src/domain/runtime/OperatorCooldownGuard.ts
src/domain/runtime/RuntimeDrawdownLock.ts
src/domain/runtime/RuntimeDrawdownMonitor.ts
src/domain/runtime/RuntimeEnforcementOrchestrator.ts
src/domain/runtime/RuntimeMemoryPressureMonitor.ts
src/domain/runtime/RuntimeSanityEngine.ts
src/domain/runtime/RuntimeStateMachine.ts
src/domain/runtime/SessionCircuitBreaker.ts
src/domain/runtime/TelemetryContracts.ts
src/domain/runtime/codespaces-log-artifact-exporter.ts
src/domain/security/InputHardeningEngine.ts
src/domain/sequential/SequentialBiasDetector.ts
src/domain/services/BacktestEngine.ts
src/domain/services/BayesianEdgeValidator.ts
src/domain/services/ConfidenceScorer.ts
src/domain/services/ImageAnalysisService.ts
src/domain/services/MonteCarloEngine.ts
src/domain/services/RegimeDetector.ts
src/domain/services/RiskPolicy.ts
src/domain/services/RouletteStats.ts
src/domain/services/StrategyEngine.ts
src/domain/session/AdaptiveSupervisionIntelligenceEngine.ts
src/domain/session/AssistedSessionIntelligenceEngine.ts
src/domain/session/ConfidenceAwareOcrFusionEngine.ts
src/domain/session/ContextualFailurePredictionEngine.ts
src/domain/session/IncrementalSessionUpdateEngine.js
src/domain/session/InstitutionalAuditEngine.ts
src/domain/session/InstitutionalReplayEngine.ts
src/domain/session/InstitutionalSessionRhythmEngine.ts
src/domain/session/InstitutionalTrustScoreEngine.ts
src/domain/session/LiveConsensusEngine.js
src/domain/session/LiveContextSnapshotEngine.js
src/domain/session/LiveRiskEscalationEngine.js
src/domain/session/LiveSessionRuntime.ts
src/domain/session/LiveSessionStateMachine.ts
src/domain/session/LiveVetoEngine.js
src/domain/session/OcrReliabilityIntelligenceEngine.ts
src/domain/session/OcrSelfHealingEngine.ts
src/domain/session/OperatorBehavioralFingerprintEngine.ts
src/domain/session/PaperSessionSupervisorV2.js
src/domain/session/RuntimeSessionIdentity.ts
src/domain/session/SessionPatternMemoryEngine.ts
src/domain/session/SessionPersistenceEngine.ts
src/domain/session/WarmupSessionAnalyzer.ts
src/domain/session/index.ts
src/domain/shared/Result.ts
src/domain/simulation/BootstrapResampler.ts
src/domain/simulation/MonteCarloV2Engine.ts
src/domain/snapshot/AdaptiveSnapshotRotationEngine.ts
src/domain/snapshot/SnapshotRevocationEngine.ts
src/domain/statistics/HypothesisValidator.ts
src/domain/statistics/IncrementalStatisticsEngine.ts
src/domain/statistics/StatisticalSignificanceEngine.ts
src/domain/strategy-reputation/strategy-reputation-engine.ts
src/domain/strategy/MultiStrategyRuntimeCoordinator.js
src/domain/strategy/OperatorActionCenter.js
src/domain/strategy/StrategyCapabilityMap.ts
src/domain/strategy/StrategyCompatibilityEngine.js
src/domain/strategy/StrategyCooldownEngine.js
src/domain/strategy/StrategyCooldownVisualizer.js
src/domain/strategy/StrategyDashboardEngine.js
src/domain/strategy/StrategyEnsembleEngine.ts
src/domain/strategy/StrategyExplainabilityEngine.js
src/domain/strategy/StrategyRankingEngine.ts
src/domain/strategy/StrategyRecommendationEngine.js
src/domain/strategy/StrategyRecoveryEngine.js
src/domain/strategy/StrategyRegistry.ts
src/domain/strategy/StrategyResultLedgerEngine.js
src/domain/strategy/StrategyRuntimeOrchestrator.js
src/domain/strategy/StrategyStatusPresenter.js
src/domain/strategy/impl/FusionReduzida.ts
src/domain/strategy/impl/Triplicacao.ts
src/domain/stress/RuntimeStressHarness.ts
src/domain/stress/index.ts
src/domain/supervision/AdaptiveWaitingTimeEngine.js
src/domain/supervision/CooldownEnforcementEngine.js
src/domain/supervision/assisted-session-intelligence-engine.ts
src/domain/supervision/institutional-audit-engine.ts
src/domain/supervision/institutional-replay-engine.ts
src/domain/supervision/institutional-session-rhythm-engine.ts
src/domain/table-reputation/table-reputation-engine.ts
src/domain/temporal/TemporalDecayEngine.ts
src/domain/usecases/GetSignalsUseCase.ts
src/domain/usecases/ProcessSignalsUseCase.ts
src/domain/validation/WalkForwardValidationLab.ts
src/domain/vision/VisionReliabilityInspector.ts
src/domain/vision/VisionWarmupNormalizer.ts
src/domain/vision/confidence-aware-ocr-fusion-engine.ts
src/domain/vision/ocr-reliability-intelligence-engine.ts
src/domain/vision/ocr-self-healing-engine.ts
src/domain/warmup-upload-ingestion/index.ts
src/domain/warmup-upload-ingestion/warmup-upload-ingestion-engine.ts
src/domain/warmup/WarmupIntegrityValidator.js
src/domain/warmup/WarmupQualificationEngine.js
src/domain/warmup/WarmupSessionBootstrapEngine.js
```

---

## 4. DECISION CONTINUITY

---

## 5. SYSTEM INTERPRETATION

The system has been reconstructed from external bootstrap state.

This enables:

- continuation of RL.SYS CORE sessions
- recovery after session loss
- structural rehydration of architecture understanding

---

## 6. EMERGENT INSIGHT

Instead of relying on memory, the system operates as:

> externally reconstructed intelligence state machine

---

## 7. LIMITATIONS

- reconstruction is text-based (not execution-aware)
- no live runtime validation
- depends entirely on bootstrap integrity

---

## 8. NEXT EVOLUTION

R0-BOOT-AI → AUTONOMOUS CONTEXT COMPRESSOR & MEMORY SIMULATOR

