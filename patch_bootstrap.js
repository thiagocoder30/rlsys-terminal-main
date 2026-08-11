const fs = require('fs');

// Patch RuntimeConfigurationLoader
let loader = fs.readFileSync('src/application/bootstrap/RuntimeConfigurationLoader.ts', 'utf8');
loader = loader.replace(
    "import { SessionControlEngine } from '../session-control/SessionControlEngine';",
    "import { SessionControlEngine } from '../session-control/SessionControlEngine';\nimport { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';"
);
loader = loader.replace(
    "sessionControlEngine?: SessionControlEngine,",
    "sessionControlEngine?: SessionControlEngine,\n        startupWizard?: SessionStartupWizard,\n        lifecycleManager?: SessionLifecycleManager"
);
loader = loader.replace(
    "startupWizard?: SessionStartupWizard",
    "// removed" // handled above
);
loader = loader.replace(
    "const isSessionActive = sessionState ? sessionState.status === 'ACTIVE' : false;",
    "const isSessionActive = lifecycleManager ? lifecycleManager.getCurrentState() === 'ACTIVE' : false;"
);
fs.writeFileSync('src/application/bootstrap/RuntimeConfigurationLoader.ts', loader);

// Patch ApplicationBootstrap
let bootstrap = fs.readFileSync('src/application/bootstrap/ApplicationBootstrap.ts', 'utf8');
bootstrap = bootstrap.replace(
    "import { SessionStartupWizard } from '../session-startup/SessionStartupWizard';",
    "import { SessionStartupWizard } from '../session-startup/SessionStartupWizard';\nimport { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';"
);
bootstrap = bootstrap.replace(
    "private readonly startupWizard: SessionStartupWizard,\n        private readonly eventBus: ObservabilityEventBus",
    "private readonly startupWizard: SessionStartupWizard,\n        private readonly lifecycleManager: SessionLifecycleManager,\n        private readonly eventBus: ObservabilityEventBus"
);
bootstrap = bootstrap.replace(
    "const loadedState = RuntimeConfigurationLoader.loadState(\n            this.configEngine,\n            this.sessionControlEngine,\n            this.startupWizard\n        );",
    "const loadedState = RuntimeConfigurationLoader.loadState(\n            this.configEngine,\n            this.sessionControlEngine,\n            this.startupWizard,\n            this.lifecycleManager\n        );"
);
bootstrap = bootstrap.replace(
    "const loadedState = RuntimeConfigurationLoader.loadState(\n            this.configEngine,\n            this.sessionControlEngine,\n            this.startupWizard\n        );", // Second occurrence in syncRuntime
    "const loadedState = RuntimeConfigurationLoader.loadState(\n            this.configEngine,\n            this.sessionControlEngine,\n            this.startupWizard,\n            this.lifecycleManager\n        );"
);
// Make decision based on lifecycleManager
bootstrap = bootstrap.replace(
    "const decision: BootstrapDecision = (isValid && state.configured)\n            ? 'READY_FOR_SESSION'\n            : 'READY_FOR_STARTUP';",
    "const decision: BootstrapDecision = (isValid && state.configured)\n            ? 'READY_FOR_SESSION'\n            : 'READY_FOR_STARTUP';" // Wait, this is in BootstrapValidator
);
fs.writeFileSync('src/application/bootstrap/ApplicationBootstrap.ts', bootstrap);
