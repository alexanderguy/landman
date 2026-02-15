type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}

export class Logger {
  private level: LogLevel
  private useColor: boolean

  constructor(level: LogLevel = "info", useColor = true) {
    this.level = level
    this.useColor = useColor && process.stdout.isTTY
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      const prefix = this.colorize(`${COLORS.gray}[DEBUG]${COLORS.reset}`, "")
      console.debug(`${prefix} ${message}`, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      const prefix = this.colorize(`${COLORS.blue}[INFO]${COLORS.reset}`, "[INFO]")
      console.info(`${prefix} ${message}`, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      const prefix = this.colorize(`${COLORS.yellow}[WARN]${COLORS.reset}`, "[WARN]")
      console.warn(`${prefix} ${message}`, ...args)
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      const prefix = this.colorize(`${COLORS.red}[ERROR]${COLORS.reset}`, "[ERROR]")
      console.error(`${prefix} ${message}`, ...args)
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      const prefix = this.colorize(`${COLORS.green}[SUCCESS]${COLORS.reset}`, "[SUCCESS]")
      console.info(`${prefix} ${message}`, ...args)
    }
  }

  progress(message: string, current?: number, total?: number): void {
    if (this.shouldLog("info")) {
      const prefix = this.colorize(`${COLORS.cyan}[PROGRESS]${COLORS.reset}`, "[PROGRESS]")
      if (current !== undefined && total !== undefined) {
        const percentage = Math.round((current / total) * 100)
        console.info(`${prefix} ${message} (${current}/${total} - ${percentage}%)`)
      } else {
        console.info(`${prefix} ${message}`)
      }
    }
  }

  private colorize(colored: string, plain: string): string {
    return this.useColor ? colored : plain
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  setUseColor(useColor: boolean): void {
    this.useColor = useColor && process.stdout.isTTY
  }
}

export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || "info")
