import { test, expect, describe, beforeAll } from "bun:test"
import { discoverPlugins, getAllPropertySources, clearRegistry } from "../../src/plugins/registry"

describe("Plugin auto-discovery", () => {
  beforeAll(async () => {
    clearRegistry()
    await discoverPlugins()
  })

  test("discovers both LandWatch and Lands of America plugins", () => {
    const sources = getAllPropertySources()
    const sourceNames = sources.map((s) => s.metadata.name)

    expect(sources.length).toBeGreaterThanOrEqual(2)
    expect(sourceNames).toContain("landwatch")
    expect(sourceNames).toContain("landsofamerica")
  })

  test("LandWatch plugin has correct metadata", () => {
    const sources = getAllPropertySources()
    const landwatch = sources.find((s) => s.metadata.name === "landwatch")

    expect(landwatch).toBeDefined()
    expect(landwatch?.metadata.displayName).toBe("LandWatch")
    expect(landwatch?.metadata.supportedFilters.states).toBe(true)
    expect(landwatch?.metadata.supportedFilters.priceRange).toBe(true)
    expect(landwatch?.metadata.supportedFilters.acreageRange).toBe(true)
  })

  test("Lands of America plugin has correct metadata", () => {
    const sources = getAllPropertySources()
    const loa = sources.find((s) => s.metadata.name === "landsofamerica")

    expect(loa).toBeDefined()
    expect(loa?.metadata.displayName).toBe("Lands of America")
    expect(loa?.metadata.supportedFilters.states).toBe(true)
    expect(loa?.metadata.supportedFilters.priceRange).toBe(true)
    expect(loa?.metadata.supportedFilters.acreageRange).toBe(true)
  })

  test("plugins support state filtering", () => {
    const sources = getAllPropertySources()
    const landwatch = sources.find((s) => s.metadata.name === "landwatch")
    const loa = sources.find((s) => s.metadata.name === "landsofamerica")

    expect(landwatch?.metadata.supportedFilters.states).toBe(true)
    expect(loa?.metadata.supportedFilters.states).toBe(true)
  })

  test("both plugins provide search function", () => {
    const sources = getAllPropertySources()
    const landwatch = sources.find((s) => s.metadata.name === "landwatch")
    const loa = sources.find((s) => s.metadata.name === "landsofamerica")

    expect(typeof landwatch?.search).toBe("function")
    expect(typeof loa?.search).toBe("function")
  })
})
