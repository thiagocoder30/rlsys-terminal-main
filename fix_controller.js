const fs = require('fs');
let content = fs.readFileSync('src/infrastructure/http/controllers/OperatorController.ts', 'utf8');

content = content.replace(
    "public executeStartupSync = async (_req: Request, res: Response) => {",
    "public executeStartupSync = async (req: Request, res: Response) => {"
);
content = content.replace(
    "const success = await this.runtime.sessionStartupWizard.executeSync();",
    "const { numbers } = req.body;\n        const success = await this.runtime.sessionStartupWizard.executeSync(numbers || []);"
);

fs.writeFileSync('src/infrastructure/http/controllers/OperatorController.ts', content);
