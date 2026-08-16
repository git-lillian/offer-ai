/**
 * Structured logger — a thin wrapper around a console-based JSON logger.
 *
 * Every log line carries a correlation id when provided, so requests and
 * background tasks can be traced end to end. This replaces random
 * `console.log` calls as the production logging strategy.
 */

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export interface Logger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type Level = (typeof LEVELS)[number];
type LogLevelConfig = Level | "silent";

class ConsoleLogger implements Logger {
  constructor(
    private readonly level: LogLevelConfig = "info",
    private readonly bindings: LogContext = {},
  ) {}

  private log(level: Level, message: string, context?: LogContext): void {
    if (this.level === "silent") return;
    const configured = LEVELS.indexOf(this.level);
    const current = LEVELS.indexOf(level);
    if (current > configured) return;

    const record = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.bindings,
      ...context,
    };

    const output = JSON.stringify(record);
    if (level === "error" || level === "fatal") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  fatal(message: string, context?: LogContext): void {
    this.log("fatal", message, context);
  }
  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
  child(bindings: LogContext): Logger {
    return new ConsoleLogger(this.level, { ...this.bindings, ...bindings });
  }
}

export function createLogger(level: LogLevelConfig = "info"): Logger {
  return new ConsoleLogger(level);
}
