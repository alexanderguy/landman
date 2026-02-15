import { Database, type SQLQueryBindings } from "bun:sqlite"

export class DatabaseClient {
  public db: Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.exec("PRAGMA foreign_keys = ON")
    this.db.exec("PRAGMA journal_mode = WAL")
  }

  query<T = unknown>(sql: string, params: SQLQueryBindings[] = []): T[] {
    const stmt = this.db.prepare(sql)
    return stmt.all(...params) as T[]
  }

  queryOne<T = unknown>(sql: string, params: SQLQueryBindings[] = []): T | null {
    const stmt = this.db.prepare(sql)
    const result = stmt.get(...params)
    return (result as T) || null
  }

  execute(sql: string, params: SQLQueryBindings[] = []): void {
    const stmt = this.db.prepare(sql)
    stmt.run(...params)
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  close(): void {
    this.db.close()
  }

  get isOpen(): boolean {
    return this.db !== null
  }
}
