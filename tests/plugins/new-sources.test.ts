import { test, expect } from "bun:test"
import { discoverPlugins, getPropertySource, clearRegistry } from "../../src/plugins/registry"

test("New source plugins are discoverable", async () => {
  clearRegistry()
  await discoverPlugins()

  const zillow = getPropertySource("zillow")
  const landsearch = getPropertySource("landsearch")

  expect(zillow).toBeDefined()
  expect(landsearch).toBeDefined()

  expect(zillow?.metadata.name).toBe("zillow")
  expect(zillow?.metadata.displayName).toBe("Zillow")
  expect(zillow?.metadata.supportedFilters.states).toBe(true)
  expect(zillow?.metadata.supportedFilters.priceRange).toBe(true)
  expect(zillow?.metadata.supportedFilters.acreageRange).toBe(true)

  expect(landsearch?.metadata.name).toBe("landsearch")
  expect(landsearch?.metadata.displayName).toBe("LandSearch")
})

test("All major sources are available", async () => {
  clearRegistry()
  await discoverPlugins()

  const landwatch = getPropertySource("landwatch")
  const landsofamerica = getPropertySource("landsofamerica")
  const landsearch = getPropertySource("landsearch")
  const zillow = getPropertySource("zillow")

  expect(landwatch).toBeDefined()
  expect(landsofamerica).toBeDefined()
  expect(landsearch).toBeDefined()
  expect(zillow).toBeDefined()
})

test("New plugins have search function", async () => {
  clearRegistry()
  await discoverPlugins()

  const landsearch = getPropertySource("landsearch")
  const zillow = getPropertySource("zillow")

  expect(landsearch).toBeDefined()
  expect(zillow).toBeDefined()

  expect(typeof landsearch?.search).toBe("function")
  expect(typeof zillow?.search).toBe("function")
})
