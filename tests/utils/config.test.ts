import { test, expect } from "bun:test"
import { ConfigManager } from "../../src/utils/config"
import { join } from "path"

const configPath = join(import.meta.dir, "../../config/search-criteria.json")

test("ConfigManager loads config file", () => {
  const config = new ConfigManager(configPath)
  expect(config).toBeDefined()
})

test("ConfigManager returns active profile", () => {
  const config = new ConfigManager(configPath)
  const profile = config.getActiveProfile()

  expect(profile).toBeDefined()
  expect(profile.name).toBe("Comprehensive Mountain West Search")
  expect(profile.criteria.states).toContain("MT")
})

test("ConfigManager lists all profiles", () => {
  const config = new ConfigManager(configPath)
  const profiles = config.listProfiles()

  expect(profiles).toContain("default")
  expect(profiles).toContain("montana-only")
  expect(profiles).toContain("budget-friendly")
})

test("ConfigManager gets specific profile", () => {
  const config = new ConfigManager(configPath)
  const profile = config.getProfile("montana-only")

  expect(profile.name).toBe("Montana Focus")
  expect(profile.criteria.states).toEqual(["MT"])
})

test("ConfigManager throws on missing profile", () => {
  const config = new ConfigManager(configPath)

  expect(() => config.getProfile("nonexistent")).toThrow("Profile 'nonexistent' not found")
})
