const fs = require('fs');

let loader = fs.readFileSync('src/application/bootstrap/RuntimeConfigurationLoader.ts', 'utf8');

loader = loader.replace(
    "        // removed,\n        lifecycleManager?: SessionLifecycleManager\n        startupWizard?: SessionStartupWizard",
    "        startupWizard?: SessionStartupWizard,\n        lifecycleManager?: SessionLifecycleManager"
);

fs.writeFileSync('src/application/bootstrap/RuntimeConfigurationLoader.ts', loader);
