import { DatabaseClient } from "./client"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(client: DatabaseClient): Promise<void> {
  const schemaPath = join(__dirname, "schema.sql")
  const schema = readFileSync(schemaPath, "utf-8")

  try {
    client.db.exec("PRAGMA foreign_keys = OFF;")
    client.db.exec(schema)
    client.db.exec("PRAGMA foreign_keys = ON;")
  } catch (error) {
    console.error(`Migration failed:`, error)
    throw error
  }

  console.log("Database migrations completed successfully")
}

// Expose db property for migrations
declare module "./client" {
  interface DatabaseClient {
    db: any
  }
}

export async function initializeDatabase(dbPath: string): Promise<DatabaseClient> {
  const client = new DatabaseClient(dbPath)
  await runMigrations(client)
  return client
}
