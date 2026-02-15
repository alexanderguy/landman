import { Command } from "commander"
import { ConfigManager } from "../../utils/config"
import { formatProfileTable } from "../formatter"
import { logger } from "../../utils/logger"
import path from "path"
import { readFileSync } from "fs"
import type { ConfigFile } from "../../models/search-criteria"

export const profileCommand = new Command("profile")
  .description("Manage search profiles")

profileCommand
  .command("list")
  .description("List all available profiles")
  .action(() => {
    const configPath = path.join(process.cwd(), "config", "search-criteria.json")
    const configManager = new ConfigManager(configPath)

    const content = readFileSync(configPath, "utf-8")
    const config = JSON.parse(content) as ConfigFile

    console.log(formatProfileTable(config.profiles, config.activeProfile))
  })

profileCommand
  .command("activate")
  .description("Set the active profile")
  .argument("<name>", "Profile name to activate")
  .action((name: string) => {
    const configPath = path.join(process.cwd(), "config", "search-criteria.json")
    const configManager = new ConfigManager(configPath)

    try {
      configManager.setActiveProfile(name)
      logger.info(`Activated profile: ${name}`)
    } catch (error) {
      logger.error(`Failed to activate profile: ${error}`)
      process.exit(1)
    }
  })

profileCommand
  .command("show")
  .description("Show details of a profile")
  .argument("<name>", "Profile name to display")
  .action((name: string) => {
    const configPath = path.join(process.cwd(), "config", "search-criteria.json")
    const configManager = new ConfigManager(configPath)

    try {
      const profile = configManager.getProfile(name)

      console.log(`Profile: ${profile.name}`)
      console.log(`Description: ${profile.description}`)
      console.log("")
      console.log("Search Criteria:")
      console.log(JSON.stringify(profile.criteria, null, 2))
      console.log("")
      console.log("Enabled Plugins:")
      for (const [pluginName, config] of Object.entries(profile.plugins)) {
        if (config.enabled) {
          console.log(`  - ${pluginName} (priority: ${config.priority})`)
        }
      }
    } catch (error) {
      logger.error(`Failed to show profile: ${error}`)
      process.exit(1)
    }
  })

profileCommand
  .command("create")
  .description("Create a new profile by duplicating an existing one")
  .argument("<new-name>", "Name for the new profile")
  .option("-f, --from <profile>", "Profile to duplicate (defaults to active)")
  .option("-d, --description <desc>", "Description for the new profile")
  .action((newName: string, options) => {
    const configPath = path.join(process.cwd(), "config", "search-criteria.json")

    try {
      const content = readFileSync(configPath, "utf-8")
      const config = JSON.parse(content) as ConfigFile

      if (config.profiles[newName]) {
        logger.error(`Profile '${newName}' already exists`)
        process.exit(1)
      }

      const sourceProfileName = options.from || config.activeProfile
      const sourceProfile = config.profiles[sourceProfileName]

      if (!sourceProfile) {
        logger.error(`Source profile '${sourceProfileName}' not found`)
        process.exit(1)
      }

      const newProfile = {
        ...sourceProfile,
        name: newName,
        description: options.description || `Copy of ${sourceProfile.name}`,
      }

      config.profiles[newName] = newProfile

      const { writeFileSync } = require("fs")
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")

      logger.success(`Created profile '${newName}' based on '${sourceProfileName}'`)
      logger.info("Use 'landbot config edit' to customize the new profile")
    } catch (error) {
      logger.error(`Failed to create profile: ${error}`)
      process.exit(1)
    }
  })
