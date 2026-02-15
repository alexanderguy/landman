import { test, expect } from "bun:test"
import {
  registerPropertySource,
  registerDeduplicationPlugin,
  getPropertySource,
  getAllPropertySources,
  getDeduplicationPlugin,
  getAllDeduplicationPlugins,
} from "../../src/plugins/registry"
import type { PropertySource, DeduplicationPlugin } from "../../src/plugins/types"
import type { Property } from "../../src/models/property"
import type { SearchCriteria } from "../../src/models/search-criteria"

test("registers and retrieves property source plugins", () => {
  const mockSource: PropertySource = {
    metadata: {
      name: "test-source",
      displayName: "Test Source",
      version: "1.0.0",
      description: "A test property source",
      supportedFilters: {
        states: true,
        priceRange: true,
      },
    },
    async *search(_criteria: SearchCriteria): AsyncGenerator<Property, void, unknown> {
      yield {
        id: "test-1",
        source: "test-source",
        source_id: "1",
        url: "https://test.com/1",
        title: "Test Property",
      }
    },
  }

  registerPropertySource(mockSource)

  const retrieved = getPropertySource("test-source")
  expect(retrieved).toBeDefined()
  expect(retrieved?.metadata.name).toBe("test-source")

  const allSources = getAllPropertySources()
  expect(allSources.length).toBeGreaterThan(0)
})

test("registers and retrieves deduplication plugins", () => {
  const mockDedup: DeduplicationPlugin = {
    name: "test-dedup",
    async findDuplicates(_property: Property, _candidates: Property[]) {
      return []
    },
  }

  registerDeduplicationPlugin(mockDedup)

  const retrieved = getDeduplicationPlugin("test-dedup")
  expect(retrieved).toBeDefined()
  expect(retrieved?.name).toBe("test-dedup")

  const allDedup = getAllDeduplicationPlugins()
  expect(allDedup.length).toBeGreaterThan(0)
})

test("warns on duplicate registration", () => {
  const mockSource: PropertySource = {
    metadata: {
      name: "duplicate-test",
      displayName: "Duplicate Test",
      version: "1.0.0",
      description: "Test duplicate registration",
      supportedFilters: {},
    },
    async *search(_criteria: SearchCriteria): AsyncGenerator<Property, void, unknown> {},
  }

  registerPropertySource(mockSource)
  registerPropertySource(mockSource)

  const allSources = getAllPropertySources()
  const duplicates = allSources.filter((s) => s.metadata.name === "duplicate-test")
  expect(duplicates.length).toBe(1)
})
