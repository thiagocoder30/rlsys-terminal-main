const fs = require('fs');
let content = fs.readFileSync('src/infrastructure/http/controllers/RuntimeController.ts', 'utf8');

content = content.replace(
    "this.ledger,\n        this.configurationEngine\n    );",
    "this.ledger,\n        this.configurationEngine,\n        this.sessionLifecycleManager\n    );"
);

fs.writeFileSync('src/infrastructure/http/controllers/RuntimeController.ts', content);
