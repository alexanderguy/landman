import { Command } from "commander"
import { DatabaseClient } from "../../db/client"
import { PropertyRepository } from "../../db/repository"
import { ConfigManager } from "../../utils/config"
import { runSearch } from "../../core/search-engine"
import { discoverPlugins } from "../../plugins/registry"
import type { SearchCallbacks } from "../../plugins/types"
import { logger } from "../../utils/logger"
import path from "path"

export const searchCommand = new Command("search")
  .description("Search for properties using the active or specified profile")
  .option("-p, --profile <name>", "Profile to use for search")
  .action(async (options) => {
    const configPath = path.join(process.cwd(), "config", "search-criteria.json")
    const dbPath = path.join(process.cwd(), "data", "landbot.db")

    await discoverPlugins()

    const configManager = new ConfigManager(configPath)
    const profile = options.profile
      ? configManager.getProfile(options.profile)
      : configManager.getActiveProfile()

    logger.info(`Using profile: ${profile.name}`)
    logger.info(`Description: ${profile.description}`)

    const db = new DatabaseClient(dbPath)
    const repository = new PropertyRepository(db)

    let totalPropertiesFound = 0

    const callbacks: SearchCallbacks = {
      onProgress: (message: string) => {
        logger.progress(message)
      },
      onPropertyFound: () => {
        totalPropertiesFound++
      },
      onError: (error: Error) => {
        logger.error(error.message)
      },
    }

    try {
      logger.info("")
      logger.info("Starting property search...")
      logger.info("")

      const result = await runSearch({
        repository,
        profile,
        callbacks,
      })

      logger.info("")
      logger.success("Search complete!")
      logger.info(`  Properties found: ${result.propertiesFound}`)
      logger.info(`  Sources used: ${result.sourcesUsed.join(", ")}`)

      if (result.errors.length > 0) {
        logger.warn(`  Errors encountered: ${result.errors.length}`)
        for (const error of result.errors) {
          logger.warn(`    - ${error}`)
        }
      }

      logger.info("")
      logger.info("Use 'landbot list' to view results")
    } catch (error) {
      logger.error(`Search failed: ${error instanceof Error ? error.message : String(error)}`)
      if (error instanceof Error && error.stack) {
        logger.debug(error.stack)
      }
      process.exit(1)
    } finally {
      db.close()
    }
  })
