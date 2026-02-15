#!/usr/bin/env bun

import { initializeDatabase } from "../src/db/migrations"
import { join } from "path"

const dbPath = process.env.DATABASE_PATH || join(import.meta.dir, "../data/landbot.db")

console.log(`Initializing database at: ${dbPath}`)

try {
  const db = await initializeDatabase(dbPath)
  console.log("✓ Database initialized successfully")
  db.close()
} catch (error) {
  console.error("✗ Database initialization failed:", error)
  process.exit(1)
}
