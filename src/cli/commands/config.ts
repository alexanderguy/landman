import { Command } from "commander"
import { ConfigManager } from "../../utils/config"
import { logger } from "../../utils/logger"
import path from "path"
import fs from "fs"

const configCommand = new Command("config")
  .description("View and edit configuration")

configCommand
  .command("show")
  .description("Show current configuration")
  .option("-p, --profile <name>", "Show specific profile (defaults to active)")
  .action((options) => {
    const configPath = path.join(process.cwd(), "config", "search-config.json")
    const manager = new ConfigManager(configPath)

    try {
      const profileName = options.profile || manager.getActiveProfile().name
      const profile = manager.getProfile(profileName)

      console.log(`\nProfile: ${profile.name}`)
      console.log(`Description: ${profile.description}\n`)

      console.log("Search Criteria:")
      console.log(`  States: ${profile.criteria.states.join(", ")}`)
      console.log(`  Min Acres: ${profile.criteria.minAcres}`)
      if (profile.criteria.maxAcres) {
        console.log(`  Max Acres: ${profile.criteria.maxAcres}`)
      }

      console.log("\nPrice Range:")
      if (profile.criteria.priceRange.default.min) {
        console.log(`  Min: $${profile.criteria.priceRange.default.min.toLocaleString()}`)
      }
      if (profile.criteria.priceRange.default.max) {
        console.log(`  Max: $${profile.criteria.priceRange.default.max.toLocaleString()}`)
      }

      if (profile.criteria.priceRange.byRegion) {
        console.log("\nRegional Price Ranges:")
        for (const [region, range] of Object.entries(profile.criteria.priceRange.byRegion)) {
          const parts = []
          if (range.min) parts.push(`min: $${range.min.toLocaleString()}`)
          if (range.max) parts.push(`max: $${range.max.toLocaleString()}`)
          console.log(`  ${region}: ${parts.join(", ")}`)
        }
      }

      if (profile.criteria.distanceToTown) {
        console.log("\nDistance to Town:")
        console.log(`  Min: ${profile.criteria.distanceToTown.min} ${profile.criteria.distanceToTown.unit}`)
        console.log(`  Max: ${profile.criteria.distanceToTown.max} ${profile.criteria.distanceToTown.unit}`)
      }

      if (profile.criteria.waterPreferences && profile.criteria.waterPreferences.length > 0) {
        console.log("\nWater Preferences:")
        for (const pref of profile.criteria.waterPreferences) {
          console.log(`  ${pref.type}: weight ${pref.weight}`)
        }
      }

      if (profile.criteria.structurePreference) {
        console.log(`\nStructure Preference: ${profile.criteria.structurePreference}`)
      }

      if (profile.criteria.terrain && profile.criteria.terrain.length > 0) {
        console.log(`\nTerrain: ${profile.criteria.terrain.join(", ")}`)
      }

      if (profile.criteria.utilityWeights) {
        console.log("\nUtility Weights:")
        for (const [utility, weight] of Object.entries(profile.criteria.utilityWeights)) {
          console.log(`  ${utility}: ${weight}`)
        }
      }

      console.log("\nEnabled Plugins:")
      const enabledPlugins = Object.entries(profile.plugins)
        .filter(([, config]) => config.enabled)
        .sort((a, b) => b[1].priority - a[1].priority)

      for (const [name, config] of enabledPlugins) {
        console.log(`  ${name} (priority: ${config.priority})`)
      }
    } catch (error) {
      logger.error(`Failed to show configuration: ${error}`)
      process.exit(1)
    }
  })

configCommand
  .command("edit")
  .description("Open configuration file in editor")
  .action(() => {
    const configPath = path.join(process.cwd(), "config", "search-config.json")

    if (!fs.existsSync(configPath)) {
      logger.error(`Configuration file not found: ${configPath}`)
      process.exit(1)
    }

    const editor = process.env.EDITOR || "vi"

    logger.info(`Opening configuration in ${editor}...`)
    logger.info(`File: ${configPath}`)

    const { spawnSync } = require("child_process")
    const result = spawnSync(editor, [configPath], { stdio: "inherit" })

    if (result.error) {
      logger.error(`Failed to open editor: ${result.error.message}`)
      process.exit(1)
    }

    if (result.status !== 0) {
      logger.error(`Editor exited with code ${result.status}`)
      process.exit(1)
    }

    try {
      const manager = new ConfigManager(configPath)
      manager.reload()
      logger.info("Configuration updated successfully")
    } catch (error) {
      logger.error(`Configuration file is invalid: ${error}`)
      logger.error("Please fix the syntax errors and try again")
      process.exit(1)
    }
  })

configCommand
  .command("path")
  .description("Show path to configuration file")
  .action(() => {
    const configPath = path.join(process.cwd(), "config", "search-config.json")
    console.log(configPath)
  })

configCommand
  .command("validate")
  .description("Validate configuration file syntax")
  .action(() => {
    const configPath = path.join(process.cwd(), "config", "search-config.json")

    try {
      const manager = new ConfigManager(configPath)
      const profiles = manager.listProfiles()

      logger.info("Configuration is valid")
      logger.info(`Found ${profiles.length} profiles: ${profiles.join(", ")}`)
    } catch (error) {
      logger.error(`Configuration is invalid: ${error}`)
      process.exit(1)
    }
  })

export { configCommand }
