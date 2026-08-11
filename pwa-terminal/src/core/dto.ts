export interface OperationalConfigurationDTO {
    provider: 'PRAGMATIC' | 'EVOLUTION';
    minimumChipValue: number;
    defaultBankroll: number;
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
    language: 'pt-BR' | 'en-US' | 'es-ES';
    autoWarmup: boolean;
    autoSyncHistory: boolean;
    defaultSyncRounds: number;
    hudCompactMode: boolean;
    terminalAutocomplete: boolean;
    terminalHistorySize: number;
    confirmSuggestions: boolean;
    showAdvancedMetrics: boolean;
    createdAt: number;
    updatedAt: number;
    version: string;
    hash: string;
}

export interface SessionDTO {
    sessionId: string;
    status: 'CREATED' | 'ACTIVE' | 'PAUSED' | 'LOCKED' | 'FINISHED' | 'RECOVERED' | 'READY' | 'WAITING_SPIN' | 'DECISION_READY' | 'PROCESSING';
    heartbeatStatus: 'ALIVE' | 'DEAD' | 'UNKNOWN';
    executionTimeMs: number;
    lastSnapshotTimeUtc: string | null;
    lastDecisionTimeUtc: string | null;
}

export interface ConsensusDTO {
    level: string;
    agreementScore: number;
    conflictLevel: string;
    dominantStrategy: string | null;
    confidenceScore: number;
    votes: {
        modelId: string;
        suggestedStrategy: string | null;
        confidence: number;
    recommendation?: OperationalDecisionDTO;
        weight: number;
    }[];
}

export interface StrategyDTO {
    strategyId: string;
    name: string;
    status: 'ENABLED' | 'DISABLED' | 'LOCKED';
    confidence: number;
    recommendation?: OperationalDecisionDTO;
    shadowWeight: number;
    ranking: number;
    lastResult: string;
}

export interface RuntimeStatusDTO {
    status: 'APPROVED' | 'REJECTED';
    reason: string | null;
    paperTrading: boolean;
    operationalVix: number;
    shannonEntropy: number;
    burnIn: number;
    adaptiveConfidence: number;
    shadowPerformance: number;
    consensusRate: number;
    riskLevel: string;
}

export interface BankrollDTO {
    initialBankroll: number;
    currentBankroll: number;
    drawdown: number;
    profit: number;
    stopLoss: number;
    takeProfit: number;
    suggestedStake: number;
    maxAllowedStake: number;
}

export interface ExplainabilityDTO {
    reasons: string[];
    summary: string;
}

export interface OperatorConsoleDTO {
    session: SessionDTO;
    runtimeStatus: RuntimeStatusDTO;
    bankroll: BankrollDTO;
    strategies: StrategyDTO[];
    consensus: ConsensusDTO;
    explainability: ExplainabilityDTO;
}

export interface StrategyEligibilityDTO {
    strategyId: string;
    status: 'ENABLED' | 'DISABLED' | 'LOCKED' | 'REJECTED';
}

export interface OperationalReadinessDTO {
    isReady: boolean;
    vixLevel: number;
    entropyLevel: number;
    burnInProgress: number;
}

export interface PreFlightReasonDTO {
    description: string;
}

export interface PreFlightResponseDTO {
    status: 'APPROVED' | 'REJECTED';
    reasons: PreFlightReasonDTO[];
    operationalReadiness: OperationalReadinessDTO;
    eligibleStrategies: StrategyEligibilityDTO[];
    approvedStake: number;
    consensus: ConsensusDTO;
    confidence: number;
    recommendation?: OperationalDecisionDTO;
}

export interface SessionStatisticsDTO {
    totalSpins: number;
    totalRecommendations: number;
    totalHolds: number;
    totalBlocks: number;
    averageVix: number;
    averageEntropy: number;
    averageConsensus: number;
    averageStake: number;
    shadowPnL: number;
    currentBankroll: number;
    drawdown: number;
    hitRate: number;
    confidence: number;
}

export interface SessionTimelineEntryDTO {
    spinNumber: number;
    drawnNumber: number;
    timestampUtc: string;
    operationalVix: number;
    entropy: number;
    consensus: number;
    suggestedStrategy: string | null;
    stake: number;
    status: string;
    processingTimeMs: number;
}

export interface RecommendationHistoryItemDTO {
    id: string;
    spinNumber: number;
    drawnNumber: number;
    strategy: string | null;
    stake: number;
    isOpportunity: boolean;
    confidence: number;
    consensus: number;
    vix: number;
    entropy: number;
    explanation: string;
    status: string;
    timestampUtc: string;
}

export interface StrategyRankingDTO {
    strategyId: string;
    confidence: number;
    metrics: any;
}

export interface OperationalDecisionDTO {
    isOpportunity: boolean;
    strategy: string | null;
    ranking: StrategyRankingDTO[];
    confidence: number;
    recommendation?: OperationalDecisionDTO;
    consensus: number;
    risk: number;
    stake: number;
    bankroll: number;
    adaptiveScore: number;
    ensembleScore: number;
    preFlightStatus: 'APPROVED' | 'REJECTED';
    explanation: string;
    lockReason: string | null;
    generatedAt: string;
}

export interface PerformanceSnapshotDTO {
    snapshotId: string;
    sessionId: string;
    timestampUtc: string;
    sessionHealth: 'EXCELLENT' | 'GOOD' | 'STABLE' | 'DEGRADED' | 'CRITICAL';
    confidenceTrend: 'UPWARD' | 'STABLE' | 'DOWNWARD';
    consensusTrend: 'EXPANDING' | 'STABLE' | 'CONTRACTING';
    averageRecommendationScore: number;
    averageStake: number;
    averageVix: number;
    averageEntropy: number;
    shadowPnL: number;
    drawdown: number;
    runtimeUptimeSeconds: number;
    recommendationAccuracy: number;
    strategyRanking: { strategyId: string; winRate: number; totalExecutions: number; rank: number }[];
    sessionQualityScore: number;
    operationalStabilityIndex: number;
}

export interface RegimeSnapshotDTO {
    snapshotId: string;
    sessionId: string;
    timestampUtc: string;
    currentRegime: 'TRENDING' | 'MEAN_REVERSION' | 'BALANCED' | 'CHAOTIC' | 'LOW_INFORMATION';
    previousRegime: 'TRENDING' | 'MEAN_REVERSION' | 'BALANCED' | 'CHAOTIC' | 'LOW_INFORMATION' | null;
    stabilityIndex: number;
    confidenceScore: number;
    persistenceCount: number;
    transitionCount: number;
    eligibleStrategyFamilies: string[];
    indicatorsUsed: {
        vix: number;
        entropy: number;
        confidence: number;
        consensus: number;
    };
    snapshotHash: string;
}

export interface StrategyWeightItemDTO {
    strategyId: string;
    dynamicWeight: number;
    confidence: number;
    consensus: number;
    shadowPnL: number;
    winRate: number;
    totalExecutions: number;
    trend: 'UPWARD' | 'STABLE' | 'DOWNWARD';
}

export interface StrategyWeightSnapshotDTO {
    snapshotId: string;
    sessionId: string;
    timestampUtc: string;
    weights: StrategyWeightItemDTO[];
    marketRegime: string;
    sessionQuality: number;
    drawdown: number;
    snapshotHash: string;
}

export interface StrategyPerformanceMetricsDTO {
    total: number;
    wins: number;
    winRate: number;
    profitLoss: number;
}

export interface RegimePerformanceMetricsDTO {
    total: number;
    wins: number;
    winRate: number;
    profitLoss: number;
}

export interface ShadowPerformanceDTO {
    snapshotId: string;
    sessionId: string;
    timestampUtc: string;
    initialBankroll: number;
    currentBankroll: number;
    totalSimulations: number;
    wins: number;
    losses: number;
    winRate: number;
    roi: number;
    drawdown: number;
    maxLossSequence: number;
    bestStrategy: string;
    strategyPerformance: Record<string, StrategyPerformanceMetricsDTO>;
    regimePerformance: Record<string, RegimePerformanceMetricsDTO>;
    snapshotHash: string;
}

export interface FeedbackSnapshotDTO {
    totalEvidence: number;
    approved: number;
    rejected: number;
    averageQuality: number;
    latestDecisionStatus: 'APPROVED' | 'REJECTED' | 'NONE';
    latestRejectionReason: string | null;
}

export interface FeedbackDecisionDTO {
    decisionId: string;
    sessionId: string;
    evidenceType: string;
    status: 'APPROVED' | 'REJECTED';
    reason: string;
    timestamp: string;
    hash: string;
}

export interface DecisionTimelineEntryDTO {
    timestamp: string;
    event: string;
    description: string;
    reference: string;
    hash: string;
}

export interface DecisionExplanationDTO {
    chosenStrategy: string;
    discardedStrategies: string[];
    consensus: number;
    confidence: number;
    operationalVix: number;
    entropy: number;
    marketRegime: string;
    dynamicWeight: number;
    shadowPerformance: number;
    feedbackStatus: string;
    suggestedStake: number;
    primaryReason: string;
    favorableFactors: string[];
    unfavorableFactors: string[];
    institutionalConclusion: string;
}

export interface DecisionReplayDTO {
    decisionId: string;
    sessionId: string;
    timestamp: string;
    timeline: DecisionTimelineEntryDTO[];
    explanation: DecisionExplanationDTO;
    decisionHash: string;
    hash: string;
}

export interface KnowledgePatternDTO {
    patternId: string;
    description: string;
    frequency: number;
    confidence: number;
    source: string;
    strategy: string;
    marketRegime: string;
    approvedEvidence: number;
    lastObserved: string;
}

export interface KnowledgeSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    knowledgeVersion: string;
    hash: string;
    patterns: KnowledgePatternDTO[];
    strategySummary: { strategy: string; performance: number }[];
    regimeSummary: { regime: string; occurrences: number }[];
    confidenceSummary: number;
    statistics: KnowledgeStatisticsDTO;
}

export interface KnowledgeStatisticsDTO {
    knowledgeVersion: string;
    totalPatterns: number;
    totalApprovedEvidence: number;
    topStrategies: string[];
    topRegimes: string[];
    knowledgeHealth: number;
}

export interface InstitutionalLearningSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    knowledgeScore: number;
    evidenceScore: number;
    replayScore: number;
    shadowScore: number;
    calibrationScore: number;
    performanceScore: number;
    overallLearningIndex: number;
    learningStability: number;
    hash: string;
}


export interface EvolutionSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    institutionalIntelligenceIndex: number;
    learningEfficiency: number;
    knowledgeGrowth: number;
    adaptiveStability: number;
    decisionQualityTrend: number;
    operationalEvolutionScore: number;
    hash: string;
}

export interface PredictiveScenarioDTO {
    scenarioId: string;
    description: string;
    probability: number;
    confidence: number;
    expectedOutcome: string;
    timestamp: string;
}

export interface ScenarioSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    dominantScenario: string;
    confidence: number;
    probabilityDistribution: Record<string, number>;
    knowledgeVersion: string;
    learningIndex: number;
    evolutionIndex: number;
    hash: string;
}

export interface GlobalSessionSnapshotDTO {
    globalSessionId: string;
    timestamp: string;
    correlationIndex: number;
    stabilityIndex: number;
    recurringPatterns: string[];
    seasonalityScore: number;
    institutionalConfidence: number;
    hash: string;
}

export interface StrategyContributionDTO {
    strategyId: string;
    contributionScore: number;
}

export interface RegimeExposureDTO {
    regime: string;
    exposurePercentage: number;
}

export interface PortfolioSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    portfolioHealth: number;
    diversificationIndex: number;
    concentrationIndex: number;
    portfolioConfidence: number;
    correlationMatrix: Record<string, number>;
    riskDistribution: Record<string, number>;
    strategyContributions: StrategyContributionDTO[];
    regimeExposure: RegimeExposureDTO[];
    hash: string;
}

export type EvolutionActionDTO = 'PROMOTE' | 'KEEP' | 'WATCH' | 'DEPRECATE' | 'RETIRE';

export interface StrategyEvolutionRecommendationDTO {
    recommendationId: string;
    strategyId: string;
    action: EvolutionActionDTO;
    confidence: number;
    evidenceScore: number;
    historicalSupport: number;
    riskScore: number;
    timestamp: string;
    hash: string;
}
export interface StrategyEvolutionSnapshotDTO {
    snapshotId: string;
    sessionId: string;
    timestamp: string;
    totalStrategies: number;
    promoted: number;
    watching: number;
    deprecated: number;
    retired: number;
    institutionalHealth: number;
    averageMaturity: number;
    portfolioCoverage: number;
    recommendations: StrategyEvolutionRecommendationDTO[];
    hash: string;
}

export interface InstitutionalDecisionSnapshotDTO {
    snapshotId: string;
    timestamp: string;
    overallIntelligenceScore: number;
    institutionalConfidence: number;
    institutionalConsensus: number;
    institutionalHealth: number;
    knowledgeCoverage: number;
    learningIndex: number;
    evolutionIndex: number;
    portfolioHealth: number;
    predictionConfidence: number;
    strategyMaturity: number;
    shadowAccuracy: number;
    replayConsistency: number;
    evidenceQuality: number;
    operationalReadiness: number;
    portfolioDiversification: number;
    hash: string;
}

export interface SessionStateDTO {
    status: string;
    sessionId: string;
    bankroll: {
        initial: number;
        current: number;
        profitLoss: number;
        roi: number;
        stopLossLimit: number;
        stopWinLimit: number;
    } | null;
    progress: {
        stopLossProgress: number;
        stopWinProgress: number;
    };
    metrics: {
        totalRounds: number;
        totalSuggestions: number;
        confirmedSuggestions: number;
        skippedSuggestions: number;
        wins: number;
        losses: number;
    };
}

export interface SessionAuditDTO {
    sessionId: string;
    startTime: string;
    endTime: string;
    initialBankroll: number;
    finalBankroll: number;
    totalRounds: number;
    totalSuggestions: number;
    confirmedSuggestions: number;
    skippedSuggestions: number;
    wins: number;
    losses: number;
    roi: number;
    stopReason: string;
    strategyPerformance: Record<string, any>;
    hash: string;
}

export interface EngineHealthDTO {
    vix: number;
    entropy: number;
    marketRegime: 'TRENDING' | 'CHAOTIC' | 'STABLE' | 'NEUTRAL';
}

export interface HeatmapDTO {
    hotNumbers: number[];
    coldNumbers: number[];
}

export interface StrategyWeightItemDTO {
    name: string;
    status: 'ON' | 'OFF';
    shadowPnl: number;
    weight: number;
}

export interface OperatorHUDSnapshotDTO {
    data: {
        sessionId: string;
        sessionState: string;
        currentRound: number;
        engineRounds?: number;
        recentSpins?: number[];
        oracleMessage?: string;
        xaiExplanation?: string | string[];
        targetBankroll?: number;
        stopLossValue?: number;
        engineHealth?: EngineHealthDTO;
        heatmap?: HeatmapDTO;
        strategyWeights?: StrategyWeightItemDTO[];
        bankroll: number;
        profitLoss: number;
        roi: number;
        strategySuggestion: string | null;
        confidence: string | null;
        stakeValue: number;
        chipValue: number;
        selectedTarget: string | null;
        stopWinProgress: number;
        stopLossProgress: number;
        timestamp: number;
    };
    hash: string;
}

export interface SessionAuditSnapshotDTO {
    data: {
        sessionId: string;
        startTime: number;
        endTime: number;
        initialBankroll: number;
        finalBankroll: number;
        profitLoss: number;
        roi: number;
        totalRounds: number;
        confirmedSuggestions: number;
        skippedSuggestions: number;
        wins: number;
        losses: number;
        stopReason: string;
        strategiesUsed: string[];
        performanceScore: number;
    };
    hash: string;
}

export interface AuditPerformanceReportDTO {
    evolution: {
        startingBankroll: number;
        currentBankroll: number;
        highestBankroll: number;
        lowestBankroll: number;
        maxDrawdown: number;
        growthRate: number;
        sessionCount: number;
    };
    comparison: {
        bestSession: SessionAuditSnapshotDTO | null;
        worstSession: SessionAuditSnapshotDTO | null;
        averageRoi: number;
        averageWinRate: number;
        averageScore: number;
        trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    };
    strategyPerformances: Array<{
        strategyName: string;
        sessionsCount: number;
        totalWins: number;
        totalLosses: number;
        winRate: number;
        averageRoi: number;
        performanceScore: number;
    }>;
}

export interface OperatorPerformanceProfileDTO {
    operatorId: string;
    totalSessions: number;
    totalRounds: number;
    averageROI: number;
    averageWinRate: number;
    averageStake: number;
    averageDrawdown: number;
    bestStrategy: string | null;
    worstStrategy: string | null;
    consistencyScore: number;
    riskLevel: 'LOW_RISK' | 'NORMAL' | 'ATTENTION' | 'HIGH_RISK';
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface SessionInsightDTO {
    timestamp: number;
    operatorProfile: OperatorPerformanceProfileDTO;
    riskLevel: 'LOW_RISK' | 'NORMAL' | 'ATTENTION' | 'HIGH_RISK';
    consistencyScore: number;
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    insights: string[];
}

export interface RiskBehaviorDTO {
    riskLevel: 'LOW_RISK' | 'NORMAL' | 'ATTENTION' | 'HIGH_RISK';
    averageDrawdown: number;
    maxDrawdown: number;
}

export interface TerminalExecutionResultDTO {
    commandName: string;
    success: boolean;
    output: string;
    executionTimeMs: number;
    timestamp: number;
}

export interface TerminalCommandsResponseDTO {
    commands: string[];
    summary: {
        totalExecuted: number;
        successful: number;
        failed: number;
        availableCommandsCount: number;
        latestCommand: string | null;
        latestOutput: string | null;
    };
}

export interface StartupStatusDTO {
    state: 'NOT_STARTED' | 'SELECTING_TABLE' | 'CONFIGURING_BANKROLL' | 'SYNCING_HISTORY' | 'RUNNING_WARMUP' | 'VALIDATING' | 'READY' | 'FAILED';
    percentage: number;
    completedStepsCount: number;
    totalStepsCount: number;
    tableProvider: 'Pragmatic' | 'Evolution' | null;
    bankroll: number | null;
    failureReason: string | null;
    stepsList: { name: string; completed: boolean }[];
}

export interface StartupHistoryRecordDTO {
    timestamp: number;
    tableProvider: 'Pragmatic' | 'Evolution' | null;
    bankroll: number;
    executionTimeMs: number;
    result: 'SUCCESS' | 'FAILED';
    failureReason?: string;
}
