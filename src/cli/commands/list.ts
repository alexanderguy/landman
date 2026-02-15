import { Command } from "commander"
import { DatabaseClient } from "../../db/client"
import { PropertyRepository } from "../../db/repository"
import type { PropertyFilters } from "../../db/repository"
import { formatPropertyTableWithChanges } from "../formatter"
import { logger } from "../../utils/logger"
import path from "path"

export const listCommand = new Command("list")
  .description("List saved properties")
  .option("-s, --state <state>", "Filter by state code (e.g., MT, ID)")
  .option("--min-price <price>", "Minimum price filter", parseFloat)
  .option("--max-price <price>", "Maximum price filter", parseFloat)
  .option("--min-acres <acres>", "Minimum acreage filter", parseFloat)
  .option("--max-acres <acres>", "Maximum acreage filter", parseFloat)
  .option("--min-score <score>", "Minimum score filter", parseFloat)
  .option("-l, --limit <count>", "Limit number of results", parseInt)
  .option("--since <date>", "Show changes since date (ISO format or days ago, e.g., 7)")
  .action(async (options) => {
    const dbPath = path.join(process.cwd(), "data", "landbot.db")
    const db = new DatabaseClient(dbPath)
    const repository = new PropertyRepository(db)

    try {
      const filters: PropertyFilters = {}

      if (options.state) filters.state = options.state
      if (options.minPrice !== undefined) filters.minPrice = options.minPrice
      if (options.maxPrice !== undefined) filters.maxPrice = options.maxPrice
      if (options.minAcres !== undefined) filters.minAcres = options.minAcres
      if (options.maxAcres !== undefined) filters.maxAcres = options.maxAcres
      if (options.minScore !== undefined) filters.minScore = options.minScore

      let properties = repository.findProperties(filters)

      if (options.limit) {
        properties = properties.slice(0, options.limit)
      }

      if (properties.length === 0) {
        logger.info("No properties found matching the filters")
        return
      }

      let sinceDate: string | null = null
      if (options.since) {
        if (options.since.match(/^\d+$/)) {
          const daysAgo = parseInt(options.since)
          sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
        } else {
          sinceDate = options.since
        }
      } else {
        sinceDate = repository.getLastSearchDate()
      }

      logger.info(`Found ${properties.length} properties:\n`)
      console.log(formatPropertyTableWithChanges(properties, repository, sinceDate))
    } catch (error) {
      logger.error(`Failed to list properties: ${error}`)
      process.exit(1)
    } finally {
      db.close()
    }
  })
