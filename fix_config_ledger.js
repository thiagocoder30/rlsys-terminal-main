const fs = require('fs');
let content = fs.readFileSync('src/application/configuration/ConfigurationEngine.ts', 'utf8');

content = content.replace(
    /if \(updates\.provider && updates\.provider !== prevConfig\.provider\) \{[\s\S]*?\}\n        if \(updates\.defaultBankroll/g,
    `if (updates.provider && updates.provider !== prevConfig.provider) {
            this.ledger.append(operatorId, '5.0.0', 'PROVIDER_CHANGED', \`Provider changed to \${updates.provider}\`);
            this.eventBus.publish(
                'CONFIGURATION_PROVIDER_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.provider, current: updates.provider, minimumChipValue: newConfig.minimumChipValue }
            );
        }
        if (updates.defaultBankroll`
);

content = content.replace(
    /if \(updates\.defaultBankroll !== undefined && updates\.defaultBankroll !== prevConfig\.defaultBankroll\) \{[\s\S]*?\}\n        if \(updates\.theme/g,
    `if (updates.defaultBankroll !== undefined && updates.defaultBankroll !== prevConfig.defaultBankroll) {
            this.ledger.append(operatorId, '5.0.0', 'BANKROLL_UPDATED', \`Bankroll updated to \${updates.defaultBankroll}\`);
            this.eventBus.publish(
                'CONFIGURATION_BANKROLL_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.defaultBankroll, current: updates.defaultBankroll }
            );
        }
        if (updates.theme`
);

content = content.replace(
    /if \(updates\.theme && updates\.theme !== prevConfig\.theme\) \{[\s\S]*?\}\n        if \(updates\.language/g,
    `if (updates.theme && updates.theme !== prevConfig.theme) {
            this.ledger.append(operatorId, '5.0.0', 'THEME_CHANGED', \`Theme changed to \${updates.theme}\`);
            this.eventBus.publish(
                'CONFIGURATION_THEME_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.theme, current: updates.theme }
            );
        }
        if (updates.language`
);

content = content.replace(
    /if \(updates\.language && updates\.language !== prevConfig\.language\) \{[\s\S]*?\}\n        return this\.currentConfig;/g,
    `if (updates.language && updates.language !== prevConfig.language) {
            this.ledger.append(operatorId, '5.0.0', 'LANGUAGE_CHANGED', \`Language changed to \${updates.language}\`);
            this.eventBus.publish(
                'CONFIGURATION_LANGUAGE_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.language, current: updates.language }
            );
        }
        return this.currentConfig;`
);

fs.writeFileSync('src/application/configuration/ConfigurationEngine.ts', content);
