import { Command } from "commander"
import { DatabaseClient } from "../../db/client"
import { PropertyRepository } from "../../db/repository"
import { formatPropertyDetails, formatSnapshotTable } from "../formatter"
import { logger } from "../../utils/logger"
import path from "path"

export const showCommand = new Command("show")
  .description("Show detailed information about a property")
  .argument("<id>", "Property ID (full or partial)")
  .option("-h, --history", "Show snapshot history")
  .action(async (id: string, options) => {
    const dbPath = path.join(process.cwd(), "data", "landbot.db")
    const db = new DatabaseClient(dbPath)
    const repository = new PropertyRepository(db)

    try {
      let property = repository.findById(id)

      if (!property) {
        const allProperties = repository.findProperties()
        const matches = allProperties.filter((p) => p.id.startsWith(id))

        if (matches.length === 0) {
          logger.error(`Property not found: ${id}`)
          process.exit(1)
        }

        if (matches.length > 1) {
          logger.error(`Multiple properties match '${id}':`)
          for (const match of matches) {
            logger.error(`  - ${match.id} (${match.title})`)
          }
          process.exit(1)
        }

        property = matches[0]!
      }

      if (!property) {
        logger.error("Property not found")
        process.exit(1)
      }

      console.log(formatPropertyDetails(property))

      if (options.history) {
        const snapshots = repository.getPropertySnapshots(property.id)

        if (snapshots.length > 0) {
          console.log("\nSnapshot History:")
          console.log(formatSnapshotTable(snapshots))
        } else {
          console.log("\nNo snapshot history available")
        }
      }

      const priceChanges = repository.getPriceChanges(property.id)
      if (priceChanges.length > 1) {
        console.log("\nPrice History:")
        for (const change of priceChanges) {
          const date = new Date(change.recordedAt).toLocaleString()
          console.log(`  ${date}: $${change.price.toLocaleString()}`)
        }
      }
    } catch (error) {
      logger.error(`Failed to show property: ${error}`)
      process.exit(1)
    } finally {
      db.close()
    }
  })
