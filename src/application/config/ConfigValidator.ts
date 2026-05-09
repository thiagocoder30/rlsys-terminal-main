export interface ConfigValidationIssue {
  key: string;
  severity: 'warning' | 'error';
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  issues: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  errors: ConfigValidationIssue[];
  sanitized: Record<string, string | number | boolean>;
}

export interface RuntimeConfigInput {
  serverPort: number;
  serverHost: string;
  historyBufferSize: number;
  geminiApiKey: string;
  signalLogPath: string;
  auditLogPath: string;
  dataPath: string;
  logLevel: string;
  appVersion?: string;
  nodeEnv?: string;
}

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

export class ConfigValidator {
  public validate(config: RuntimeConfigInput): ConfigValidationResult {
    const issues: ConfigValidationIssue[] = [];

    if (!Number.isInteger(config.serverPort) || config.serverPort < 1 || config.serverPort > 65535) {
      issues.push({ key: 'PORT', severity: 'error', message: 'PORT must be an integer between 1 and 65535.' });
    }

    if (!config.serverHost || typeof config.serverHost !== 'string') {
      issues.push({ key: 'HOST', severity: 'error', message: 'HOST must be a non-empty string.' });
    }

    if (!Number.isInteger(config.historyBufferSize) || config.historyBufferSize < 37) {
      issues.push({ key: 'HISTORY_BUFFER_SIZE', severity: 'error', message: 'HISTORY_BUFFER_SIZE must be at least 37.' });
    }

    if (!VALID_LOG_LEVELS.has(config.logLevel)) {
      issues.push({ key: 'LOG_LEVEL', severity: 'error', message: 'LOG_LEVEL must be one of debug, info, warn or error.' });
    }

    if (!config.geminiApiKey) {
      issues.push({ key: 'GEMINI_API_KEY', severity: 'warning', message: 'Vision endpoints will fail until GEMINI_API_KEY is configured.' });
    }

    if (!config.signalLogPath.endsWith('.jsonl')) {
      issues.push({ key: 'SIGNAL_LOG_PATH', severity: 'warning', message: 'JSONL persistence is recommended for Termux compatibility.' });
    }

    if (!config.auditLogPath.endsWith('.jsonl')) {
      issues.push({ key: 'AUDIT_LOG_PATH', severity: 'warning', message: 'Audit log should use JSONL for append-only decision traceability.' });
    }

    const errors = issues.filter(issue => issue.severity === 'error');
    const warnings = issues.filter(issue => issue.severity === 'warning');

    return {
      valid: errors.length === 0,
      issues,
      warnings,
      errors,
      sanitized: {
        appVersion: config.appVersion || 'unknown',
        nodeEnv: config.nodeEnv || 'development',
        serverPort: config.serverPort,
        serverHost: config.serverHost,
        historyBufferSize: config.historyBufferSize,
        hasGeminiApiKey: Boolean(config.geminiApiKey),
        signalLogPath: config.signalLogPath,
        auditLogPath: config.auditLogPath,
        dataPath: config.dataPath,
        logLevel: config.logLevel
      }
    };
  }

  public assertValid(config: RuntimeConfigInput): ConfigValidationResult {
    const result = this.validate(config);
    if (!result.valid) {
      const details = result.errors.map(issue => `${issue.key}: ${issue.message}`).join('; ');
      throw new Error(`Invalid runtime configuration: ${details}`);
    }
    return result;
  }
}
