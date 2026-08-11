const fs = require('fs');

let bootstrap = fs.readFileSync('src/application/bootstrap/ApplicationBootstrap.ts', 'utf8');

bootstrap = bootstrap.replace(
    "const validation = BootstrapValidator.validate(loadedState);",
    "const validation = BootstrapValidator.validate(loadedState, this.lifecycleManager.existsActiveSession());"
);

bootstrap = bootstrap.replace(
    "export type BootstrapState =\n    | 'INITIALIZING'\n    | 'LOADING_CONFIGURATION'\n    | 'VALIDATING'\n    | 'READY_FOR_STARTUP'\n    | 'READY_FOR_SESSION'\n    | 'FAILED';",
    "export type BootstrapState =\n    | 'INITIALIZING'\n    | 'LOADING_CONFIGURATION'\n    | 'VALIDATING'\n    | 'READY_FOR_STARTUP'\n    | 'READY_FOR_SESSION'\n    | 'ALREADY_ACTIVE'\n    | 'FAILED';"
);

fs.writeFileSync('src/application/bootstrap/ApplicationBootstrap.ts', bootstrap);
