const fs = require('fs');

let content = fs.readFileSync('src/application/session-control/SessionControlEngine.ts', 'utf8');

// Replace imports
content = content.replace(
    "import { SessionStatus, TableProvider, TableConfiguration } from './SessionState';",
    "import { TableProvider, TableConfiguration } from './SessionState';\nimport { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';"
);

// Constructor
content = content.replace(
    "private status: SessionStatus = SessionStatus.CREATED;\n    private bankrollManager",
    "private bankrollManager"
);
content = content.replace(
    "constructor(\n        private eventBus: ObservabilityEventBus,\n        private ledger: ObservableDecisionLedger,\n        private sessionHistory: SessionHistory\n    ) {\n        this.sessionId = 'SESSION-' + Date.now();\n        this.setupEventHandlers();\n    }",
    "constructor(\n        private eventBus: ObservabilityEventBus,\n        private ledger: ObservableDecisionLedger,\n        private sessionHistory: SessionHistory,\n        private lifecycleManager: SessionLifecycleManager\n    ) {\n        this.sessionId = 'SESSION-' + Date.now();\n        this.setupEventHandlers();\n    }"
);

// setupEventHandlers
content = content.replace(
    "if (this.status === SessionStatus.ACTIVE) {\n            this.totalRounds++;\n        }",
    "if (this.lifecycleManager.getCurrentState() === 'ACTIVE') {\n            this.totalRounds++;\n        }"
);

// startSession
content = content.replace(
    "public startSession(initialBankroll: number, tableConfig: TableConfiguration): void {\n        if (this.status === SessionStatus.ACTIVE) return;\n        \n        this.bankrollManager = new BankrollManager(initialBankroll);\n        const riskCalc = new RiskLimitCalculator();\n        this.stopLossManager = new StopLossManager(riskCalc.calculateStopLossLimit(initialBankroll));\n        this.stopWinManager = new StopWinManager(riskCalc.calculateStopWinLimit(initialBankroll));\n        this.tableConfig = tableConfig;\n        \n        this.status = SessionStatus.ACTIVE;\n        this.startTime = new Date().toISOString();\n        const payload = {\n            sessionId: this.sessionId,\n            initialBankroll,\n            tableConfig\n        };\n        \n        this.eventBus.publish('SESSION_STARTED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'SESSION_STARTED', JSON.stringify(payload));\n    }",
    "public startSession(initialBankroll: number, tableConfig: TableConfiguration): void {\n        this.bankrollManager = new BankrollManager(initialBankroll);\n        const riskCalc = new RiskLimitCalculator();\n        this.stopLossManager = new StopLossManager(riskCalc.calculateStopLossLimit(initialBankroll));\n        this.stopWinManager = new StopWinManager(riskCalc.calculateStopWinLimit(initialBankroll));\n        this.tableConfig = tableConfig;\n        this.startTime = new Date().toISOString();\n    }"
);

// getStatus
content = content.replace(
    "public getStatus(): SessionStatus {\n        return this.status;\n    }",
    "public getStatus(): string {\n        return this.lifecycleManager.getCurrentState();\n    }"
);

// handlers
content = content.replace(
    "if (this.status !== SessionStatus.ACTIVE) return null;",
    "if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return null;"
);
content = content.replace(
    "if (this.status !== SessionStatus.ACTIVE) return;",
    "if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return;"
);
content = content.replace(
    "if (this.status !== SessionStatus.ACTIVE) return;",
    "if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return;"
);
content = content.replace(
    "if (this.status !== SessionStatus.ACTIVE || !this.bankrollManager || !this.stopLossManager || !this.stopWinManager) return;",
    "if (this.lifecycleManager.getCurrentState() !== 'ACTIVE' || !this.bankrollManager || !this.stopLossManager || !this.stopWinManager) return;"
);

// triggers
content = content.replace(
    "private triggerStopLoss() {\n        this.status = SessionStatus.STOP_LOSS_TRIGGERED;\n        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };\n        this.eventBus.publish('STOP_LOSS_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'STOP_LOSS_TRIGGERED', JSON.stringify(payload));\n        this.finishSession('STOP_LOSS');\n    }",
    "private triggerStopLoss() {\n        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };\n        this.eventBus.publish('STOP_LOSS_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'STOP_LOSS_TRIGGERED', JSON.stringify(payload));\n        this.lifecycleManager.finishSession('STOP_LOSS');\n        this.finishSession('STOP_LOSS');\n    }"
);

content = content.replace(
    "private triggerStopWin() {\n        this.status = SessionStatus.STOP_WIN_TRIGGERED;\n        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };\n        this.eventBus.publish('STOP_WIN_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'STOP_WIN_TRIGGERED', JSON.stringify(payload));\n        this.finishSession('STOP_WIN');\n    }",
    "private triggerStopWin() {\n        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };\n        this.eventBus.publish('STOP_WIN_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'STOP_WIN_TRIGGERED', JSON.stringify(payload));\n        this.lifecycleManager.finishSession('STOP_WIN');\n        this.finishSession('STOP_WIN');\n    }"
);

// finishSession
content = content.replace(
    "public finishSession(reason: string = 'MANUAL'): void {\n        if (this.status === SessionStatus.FINISHED) return;\n        \n        const endTime = new Date().toISOString();\n        \n        if (this.bankrollManager && this.startTime) {\n            const snapshot = new SessionAuditSnapshot({\n                sessionId: this.sessionId,\n                startTime: this.startTime,\n                endTime,\n                initialBankroll: this.bankrollManager.initialBankroll,\n                finalBankroll: this.bankrollManager.currentBankroll,\n                totalRounds: this.totalRounds,\n                totalSuggestions: this.totalSuggestions,\n                confirmedSuggestions: this.confirmedSuggestions,\n                skippedSuggestions: this.skippedSuggestions,\n                wins: this.wins,\n                losses: this.losses,\n                roi: this.bankrollManager.roi,\n                stopReason: reason,\n                strategyPerformance: {}\n            });\n            this.sessionHistory.append(snapshot);\n        }\n        \n        if (this.status !== SessionStatus.STOP_LOSS_TRIGGERED && this.status !== SessionStatus.STOP_WIN_TRIGGERED) {\n            this.status = SessionStatus.FINISHED;\n        }\n        const payload = { sessionId: this.sessionId, reason };\n        this.eventBus.publish('SESSION_FINISHED', '5.0.0', 'uuid', this.sessionId, payload);\n        this.ledger.append(this.sessionId, '5.0.0', 'SESSION_FINISHED', JSON.stringify(payload));\n    }",
    "public finishSession(reason: string = 'MANUAL'): void {\n        const endTime = new Date().toISOString();\n        if (this.bankrollManager && this.startTime) {\n            const snapshot = new SessionAuditSnapshot({\n                sessionId: this.sessionId,\n                startTime: this.startTime,\n                endTime,\n                initialBankroll: this.bankrollManager.initialBankroll,\n                finalBankroll: this.bankrollManager.currentBankroll,\n                totalRounds: this.totalRounds,\n                totalSuggestions: this.totalSuggestions,\n                confirmedSuggestions: this.confirmedSuggestions,\n                skippedSuggestions: this.skippedSuggestions,\n                wins: this.wins,\n                losses: this.losses,\n                roi: this.bankrollManager.roi,\n                stopReason: reason,\n                strategyPerformance: {}\n            });\n            this.sessionHistory.append(snapshot);\n        }\n    }"
);

// getCurrentState
content = content.replace(
    "status: this.status,",
    "status: this.lifecycleManager.getCurrentState(),"
);

fs.writeFileSync('src/application/session-control/SessionControlEngine.ts', content);
