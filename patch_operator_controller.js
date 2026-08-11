const fs = require('fs');
let controller = fs.readFileSync('src/infrastructure/http/controllers/OperatorController.ts', 'utf8');

controller = controller.replace(
    "public resetStartup = (_req: Request, res: Response) => {\n        this.runtime.sessionStartupWizard.reset();\n        res.status(200).json({ status: this.runtime.sessionStartupReportService.getStartupStatus() });\n    }",
    "public resetStartup = (_req: Request, res: Response) => {\n        if (this.runtime.sessionLifecycleManager.existsActiveSession()) {\n            this.runtime.sessionLifecycleManager.finishSession('NEW_SESSION_REQUESTED');\n            this.runtime.sessionLifecycleManager.archiveSession();\n        }\n        this.runtime.sessionLifecycleManager.clearRuntime();\n        this.runtime.sessionStartupWizard.reset();\n        res.status(200).json({ status: this.runtime.sessionStartupReportService.getStartupStatus() });\n    }\n\n    public resumeSession = (_req: Request, res: Response) => {\n        if (this.runtime.sessionLifecycleManager.getCurrentState() !== 'ACTIVE') {\n            this.runtime.sessionLifecycleManager.resumeSession();\n        }\n        res.status(200).json({ success: true });\n    }"
);

// We need to add session start mapping correctly. In SessionStartupWizard, it calls sessionControlEngine.startSession. We need it to call SessionLifecycleManager.startSession too.
fs.writeFileSync('src/infrastructure/http/controllers/OperatorController.ts', controller);
