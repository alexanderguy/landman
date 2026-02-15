import type { ConfigFile, Profile } from "../models/search-criteria"
import { readFileSync, writeFileSync } from "fs"

export class ConfigManager {
  private config: ConfigFile
  private configPath: string

  constructor(configPath: string) {
    this.configPath = configPath
    this.config = this.loadConfig()
  }

  private loadConfig(): ConfigFile {
    try {
      const content = readFileSync(this.configPath, "utf-8")
      return JSON.parse(content) as ConfigFile
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`)
    }
  }

  private saveConfig(): void {
    try {
      const content = JSON.stringify(this.config, null, 2)
      writeFileSync(this.configPath, content, "utf-8")
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`)
    }
  }

  getActiveProfile(): Profile {
    const profileName = this.config.activeProfile
    return this.getProfile(profileName)
  }

  getProfile(name: string): Profile {
    const profile = this.config.profiles[name]
    if (!profile) {
      throw new Error(`Profile '${name}' not found`)
    }
    return profile
  }

  listProfiles(): string[] {
    return Object.keys(this.config.profiles)
  }

  setActiveProfile(name: string): void {
    if (!this.config.profiles[name]) {
      throw new Error(`Profile '${name}' not found`)
    }
    this.config.activeProfile = name
    this.saveConfig()
  }

  getScrapingConfig() {
    return this.config.scraping
  }

  reload(): void {
    this.config = this.loadConfig()
  }
}
