import { test, expect, describe } from "bun:test"
import landwatchPlugin from "../../src/plugins/sources/landwatch"
import type { SearchCriteria } from "../../src/models/search-criteria"

describe("LandWatch plugin", () => {
  test("metadata is correct", () => {
    expect(landwatchPlugin.metadata.name).toBe("landwatch")
    expect(landwatchPlugin.metadata.displayName).toBe("LandWatch")
    expect(landwatchPlugin.metadata.version).toBe("1.0.0")
    expect(landwatchPlugin.metadata.description).toContain("LandWatch.com")
  })

  test("supportedFilters are correctly declared", () => {
    expect(landwatchPlugin.metadata.supportedFilters.states).toBe(true)
    expect(landwatchPlugin.metadata.supportedFilters.priceRange).toBe(true)
    expect(landwatchPlugin.metadata.supportedFilters.acreageRange).toBe(true)
    expect(landwatchPlugin.metadata.supportedFilters.waterFeatures).toBe(false)
    expect(landwatchPlugin.metadata.supportedFilters.structures).toBe(false)
    expect(landwatchPlugin.metadata.supportedFilters.terrain).toBe(false)
    expect(landwatchPlugin.metadata.supportedFilters.distanceToTown).toBe(false)
  })

  test("search returns async generator", () => {
    const criteria: SearchCriteria = {
      minAcres: 20,
      states: ["MT"],
      priceRange: {
        default: { max: 500000 },
      },
    }

    const generator = landwatchPlugin.search(criteria)
    expect(typeof generator).toBe("object")
    expect(typeof generator.next).toBe("function")
  })
})
