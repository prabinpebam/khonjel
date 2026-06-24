import { join } from "node:path";

/**
 * Severity-ordered log levels. The Settings UI (System -> Developer tools -> Logging level) exposes
 * info/debug/trace; error/warn sit above info and are always emitted.
 */
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

/** Severity rank (lower = more severe). An unknown configured verbosity falls back to info. */
function rank(level: string): number {
  switch (level) {
    case "error":
      return 0;
    case "warn":
      return 1;
    case "debug":
      return 3;
    case "trace":
      return 4;
    default:
      return 2; // info
  }
}

/** True when a line of `line` severity should be emitted at the configured verbosity. */
export function shouldLog(configured: string, line: LogLevel): boolean {
  return rank(line) <= rank(configured);
}

/** One log line, e.g. `2026-06-24T12:00:00.000Z INFO  ready`. */
export function formatLogLine(now: Date, level: LogLevel, message: string): string {
  return `${now.toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
}

export interface LoggerFs {
  mkdirSync(dir: string, opts: { recursive: true }): void;
  appendFileSync(file: string, data: string): void;
}

export interface LoggerDeps {
  /** Log directory, resolved lazily (app.getPath("logs") is only valid once the app is ready). */
  dir: () => string;
  /** The configured verbosity, read fresh per line so a Settings change applies immediately. */
  level: () => string;
  fs: LoggerFs;
  now?: () => Date;
  /** Optional sink to also surface a formatted line elsewhere (e.g. the dev console). */
  mirror?: (level: LogLevel, line: string) => void;
  fileName?: string;
}

export interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  trace(message: string): void;
}

/**
 * A small level-gated file logger. Each call appends a timestamped line to `<dir>/<fileName>` when
 * the configured level permits, and is best-effort: a filesystem error never propagates, because
 * diagnostics must not crash the app.
 */
export function createLogger(deps: LoggerDeps): Logger {
  const now = deps.now ?? (() => new Date());
  const fileName = deps.fileName ?? "khonjel-main.log";
  const write = (level: LogLevel, message: string): void => {
    if (!shouldLog(deps.level(), level)) return;
    const line = formatLogLine(now(), level, message);
    try {
      const dir = deps.dir();
      deps.fs.mkdirSync(dir, { recursive: true });
      deps.fs.appendFileSync(join(dir, fileName), `${line}\n`);
    } catch {
      // best-effort: never let logging break the app
    }
    deps.mirror?.(level, line);
  };
  return {
    error: (m) => write("error", m),
    warn: (m) => write("warn", m),
    info: (m) => write("info", m),
    debug: (m) => write("debug", m),
    trace: (m) => write("trace", m),
  };
}
