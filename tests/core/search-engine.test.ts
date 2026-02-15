import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { runSearch } from "../../src/core/search-engine"
import type { PropertySource, PluginMetadata, SearchCallbacks } from "../../src/plugins/types"
import type { SearchCriteria, Profile } from "../../src/models/search-criteria"
import type { Property } from "../../src/models/property"
import { PropertyRepository } from "../../src/db/repository"
import { DatabaseClient } from "../../src/db/client"
import { runMigrations } from "../../src/db/migrations"
import { registerPropertySource, registerDeduplicationPlugin, clearRegistry } from "../../src/plugins/registry"
import { unlinkSync } from "fs"

const TEST_DB = "test-search-engine.db"

function createTestPlugin(
  name: string,
  properties: Property[],
  supportedFilters = {},
): PropertySource {
  const metadata: PluginMetadata = {
    name,
    displayName: name,
    version: "1.0.0",
    description: "Test plugin",
    supportedFilters: {
      states: false,
      priceRange: false,
      acreageRange: false,
      waterFeatures: false,
      structures: false,
      terrain: false,
      distanceToTown: false,
      ...supportedFilters,
    },
  }

  return {
    metadata,
    async *search(_criteria: SearchCriteria, _callbacks?: SearchCallbacks) {
      for (const property of properties) {
        yield property
      }
    },
  }
}

describe("runSearch", () => {
  let db: DatabaseClient
  let repository: PropertyRepository

  beforeEach(async () => {
    clearRegistry()
    if (db) {
      db.close()
    }
    try {
      unlinkSync(TEST_DB)
      unlinkSync(`${TEST_DB}-wal`)
      unlinkSync(`${TEST_DB}-shm`)
    } catch {}
    db = new DatabaseClient(TEST_DB)
    await runMigrations(db)
    repository = new PropertyRepository(db)
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    try {
      unlinkSync(TEST_DB)
      unlinkSync(`${TEST_DB}-wal`)
      unlinkSync(`${TEST_DB}-shm`)
    } catch {}
  })

  test("orchestrates search across multiple sources", async () => {
    const property1: Property = {
      id: "source1-1",
      source: "test-source-1",
      source_id: "1",
      url: "https://example.com/1",
      title: "Property 1",
      price: 50000,
      acres: 20,
    }

    const property2: Property = {
      id: "source2-1",
      source: "test-source-2",
      source_id: "1",
      url: "https://example.com/2",
      title: "Property 2",
      price: 75000,
      acres: 30,
    }

    const source1 = createTestPlugin("test-source-1", [property1], { states: true })
    const source2 = createTestPlugin("test-source-2", [property2], { priceRange: true })

    registerPropertySource(source1)
    registerPropertySource(source2)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: { max: 100000 } },
      },
      plugins: {
        "test-source-1": { enabled: true, priority: 1 },
        "test-source-2": { enabled: true, priority: 2 },
      },
    }

    const result = await runSearch({ repository, profile })

    expect(result.propertiesFound).toBe(2)
    expect(result.sourcesUsed).toContain("test-source-1")
    expect(result.sourcesUsed).toContain("test-source-2")
    expect(result.errors).toEqual([])

    const saved = repository.findProperties()
    expect(saved.length).toBe(2)
  })

  test("logs supported filters for each source", async () => {
    const property: Property = {
      id: "test-1",
      source: "test-source",
      source_id: "1",
      url: "https://example.com/1",
      title: "Test Property",
    }

    const source = createTestPlugin("test-source", [property], {
      states: true,
      priceRange: true,
      acreageRange: true,
    })

    registerPropertySource(source)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        "test-source": { enabled: true, priority: 1 },
      },
    }

    const result = await runSearch({ repository, profile })

    expect(result.filtersApplied["test-source"]).toEqual(["states", "priceRange", "acreageRange"])
  })

  test("scores properties using criteria", async () => {
    const property: Property = {
      id: "test-1",
      source: "test-source",
      source_id: "1",
      url: "https://example.com/1",
      title: "Test Property",
      waterFeatures: {
        hasWater: true,
        yearRound: true,
      },
    }

    const source = createTestPlugin("test-source", [property])
    registerPropertySource(source)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
        waterPreferences: [{ type: "year-round-water", weight: 20 }],
      },
      plugins: {
        "test-source": { enabled: true, priority: 1 },
      },
    }

    await runSearch({ repository, profile })

    const saved = repository.findById("test-1")
    expect(saved).toBeTruthy()
    expect(saved?.score).toBe(20)
  })

  test("calculates field completeness", async () => {
    const property: Property = {
      id: "test-1",
      source: "test-source",
      source_id: "1",
      url: "https://example.com/1",
      title: "Test Property",
      description: "A great property",
      acres: 40,
      price: 100000,
      state: "MT",
    }

    const source = createTestPlugin("test-source", [property])
    registerPropertySource(source)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        "test-source": { enabled: true, priority: 1 },
      },
    }

    await runSearch({ repository, profile })

    const saved = repository.findById("test-1")
    expect(saved).toBeTruthy()
    expect(saved?.fieldCompleteness).toBe(9)
  })

  test("deduplicates properties and selects canonical", async () => {
    const property1: Property = {
      id: "source1-1",
      source: "source1",
      source_id: "1",
      url: "https://example.com/1",
      title: "Property 1",
      price: 50000,
      acres: 20,
      coordinates: { latitude: 45.0, longitude: -111.0 },
    }

    const property2: Property = {
      id: "source2-1",
      source: "source2",
      source_id: "1",
      url: "https://example.com/2",
      title: "Property 1 (more complete)",
      description: "Full description",
      price: 50000,
      acres: 20,
      state: "MT",
      coordinates: { latitude: 45.0, longitude: -111.0 },
    }

    registerDeduplicationPlugin({
      name: "test-dedup",
      async findDuplicates(property: Property, candidates: Property[]) {
        if (!property.coordinates) return []

        const matches = candidates.filter(
          (c) =>
            c.id !== property.id &&
            c.coordinates?.latitude === property.coordinates?.latitude &&
            c.coordinates?.longitude === property.coordinates?.longitude,
        )

        return matches.map((m) => ({ propertyId: m.id, confidence: 1.0 }))
      },
    })

    const source1 = createTestPlugin("source1", [property1])
    const source2 = createTestPlugin("source2", [property2])

    registerPropertySource(source1)
    registerPropertySource(source2)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        source1: { enabled: true, priority: 1 },
        source2: { enabled: true, priority: 2 },
      },
    }

    const result = await runSearch({ repository, profile })

    expect(result.propertiesFound).toBe(2)

    const saved = repository.findProperties()
    expect(saved.length).toBe(2)

    const canonical = saved.find((p) => p.id === "source2-1")
    expect(canonical).toBeTruthy()
    expect(canonical?.fieldCompleteness).toBeGreaterThan(0)
  })

  test("records search run metadata", async () => {
    const property: Property = {
      id: "test-1",
      source: "test-source",
      source_id: "1",
      url: "https://example.com/1",
      title: "Test Property",
    }

    const source = createTestPlugin("test-source", [property])
    registerPropertySource(source)

    const profile: Profile = {
      name: "test-profile",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        "test-source": { enabled: true, priority: 1 },
      },
    }

    await runSearch({ repository, profile })

    const runs = db.query<{ profile_name: string; properties_found: number }>("SELECT * FROM search_runs")
    expect(runs.length).toBe(1)
    expect(runs[0]?.profile_name).toBe("test-profile")
    expect(runs[0]?.properties_found).toBe(1)
  })

  test("handles errors from sources gracefully", async () => {
    const failingSource: PropertySource = {
      metadata: {
        name: "failing-source",
        displayName: "Failing Source",
        version: "1.0.0",
        description: "Test",
        supportedFilters: {},
      },
      async *search() {
        throw new Error("Source failed")
      },
    }

    registerPropertySource(failingSource)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        "failing-source": { enabled: true, priority: 1 },
      },
    }

    const result = await runSearch({ repository, profile })

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain("failing-source")
  })

  test("respects plugin priority ordering", async () => {
    const searchOrder: string[] = []

    const source1 = createTestPlugin("low-priority", [])
    const source2 = createTestPlugin("high-priority", [])

    const wrappedSource1: PropertySource = {
      ...source1,
      async *search(criteria, callbacks) {
        searchOrder.push("low-priority")
        yield* source1.search(criteria, callbacks)
      },
    }

    const wrappedSource2: PropertySource = {
      ...source2,
      async *search(criteria, callbacks) {
        searchOrder.push("high-priority")
        yield* source2.search(criteria, callbacks)
      },
    }

    registerPropertySource(wrappedSource1)
    registerPropertySource(wrappedSource2)

    const profile: Profile = {
      name: "test",
      description: "Test profile",
      criteria: {
        minAcres: 10,
        states: ["MT"],
        priceRange: { default: {} },
      },
      plugins: {
        "low-priority": { enabled: true, priority: 1 },
        "high-priority": { enabled: true, priority: 10 },
      },
    }

    await runSearch({ repository, profile })

    expect(searchOrder[0]).toBe("high-priority")
    expect(searchOrder[1]).toBe("low-priority")
  })
})
