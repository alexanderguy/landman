import { Command } from "commander"
import { DatabaseClient } from "../../db/client"
import { PropertyRepository } from "../../db/repository"
import { logger } from "../../utils/logger"
import path from "path"

export const mergeCommand = new Command("merge")
  .description("Manually mark properties as duplicates")
  .argument("<canonical-id>", "ID of the canonical property (most complete)")
  .argument("<duplicate-id>", "ID of the duplicate property")
  .action(async (canonicalId: string, duplicateId: string) => {
    const dbPath = path.join(process.cwd(), "data", "landbot.db")
    const db = new DatabaseClient(dbPath)
    const repository = new PropertyRepository(db)

    try {
      const canonical = repository.findById(canonicalId)
      if (!canonical) {
        logger.error(`Canonical property not found: ${canonicalId}`)
        process.exit(1)
      }

      const duplicate = repository.findById(duplicateId)
      if (!duplicate) {
        logger.error(`Duplicate property not found: ${duplicateId}`)
        process.exit(1)
      }

      repository.markDuplicates(canonicalId, [duplicateId], "manual", 1.0)

      logger.info(`Successfully marked properties as duplicates:`)
      logger.info(`  Canonical: ${canonical.title}`)
      logger.info(`  Duplicate: ${duplicate.title}`)
    } catch (error) {
      logger.error(`Failed to merge properties: ${error}`)
      process.exit(1)
    } finally {
      db.close()
    }
  })
