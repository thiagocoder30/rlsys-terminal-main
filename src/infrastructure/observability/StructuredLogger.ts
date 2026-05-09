export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogContext {
  [key: string]: unknown;
}

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: StructuredLogContext;
}

export class StructuredLogger {
  constructor(
    private readonly service = 'rl-sys-core',
    private readonly minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
  ) {}

  public debug(message: string, context?: StructuredLogContext): void {
    this.write('debug', message, context);
  }

  public info(message: string, context?: StructuredLogContext): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: StructuredLogContext): void {
    this.write('warn', message, context);
  }

  public error(message: string, context?: StructuredLogContext): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: StructuredLogContext): void {
    if (!this.shouldLog(level)) return;

    const record: StructuredLogRecord = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      context: this.sanitize(context)
    };

    const serialized = JSON.stringify(record);
    if (level === 'error') console.error(serialized);
    else if (level === 'warn') console.warn(serialized);
    else console.log(serialized);
  }

  private shouldLog(level: LogLevel): boolean {
    const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
    return order[level] >= order[this.minLevel];
  }

  private sanitize(context?: StructuredLogContext): StructuredLogContext | undefined {
    if (!context) return undefined;
    const blocked = new Set(['authorization', 'cookie', 'password', 'token', 'apiKey', 'geminiApiKey']);
    const sanitized: StructuredLogContext = {};

    for (const [key, value] of Object.entries(context)) {
      sanitized[key] = blocked.has(key) ? '[REDACTED]' : value;
    }

    return sanitized;
  }
}
