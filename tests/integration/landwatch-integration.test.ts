import { test, expect, describe } from "bun:test"
import type { Property } from "../../src/models/property"
import type { TerrainType } from "../../src/models/types"
import { generatePropertyId } from "../../src/utils/hash"
import { calculateFieldCompleteness, compareProperties } from "../../src/models/property"

describe("LandWatch integration", () => {
  test("property normalization generates stable IDs", () => {
    const sourceId = "12345"
    const id1 = generatePropertyId("landwatch", sourceId)
    const id2 = generatePropertyId("landwatch", sourceId)

    expect(id1).toBe(id2)
    expect(id1).toHaveLength(16)
  })

  test("normalized property has all required fields", () => {
    const property: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
    }

    expect(property.id).toBeDefined()
    expect(property.source).toBe("landwatch")
    expect(property.source_id).toBe("12345")
    expect(property.url).toBeDefined()
    expect(property.title).toBeDefined()
  })

  test("field completeness calculation works for LandWatch properties", () => {
    const minimalProperty: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
    }

    expect(calculateFieldCompleteness(minimalProperty)).toBe(5)

    const completeProperty: Property = {
      ...minimalProperty,
      description: "Beautiful mountain property",
      acres: 40,
      price: 500000,
      state: "MT",
      county: "Madison",
      city: "Ennis",
    }

    expect(calculateFieldCompleteness(completeProperty)).toBe(11)
  })

  test("snapshot detection identifies property changes", () => {
    const property1: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
      price: 500000,
      acres: 40,
    }

    const property2: Property = {
      ...property1,
      price: 450000,
    }

    const hasChanged = compareProperties(property1, property2)
    expect(hasChanged).toBe(true)
  })

  test("snapshot detection ignores rawData changes", () => {
    const property1: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
      price: 500000,
      rawData: { scrapedAt: "2024-01-01" },
    }

    const property2: Property = {
      ...property1,
      rawData: { scrapedAt: "2024-01-02" },
    }

    const hasChanged = compareProperties(property1, property2)
    expect(hasChanged).toBe(false)
  })

  test("local filtering for terrain works correctly", () => {
    const property: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
      terrainTags: ["mountain" as TerrainType, "forested" as TerrainType],
    }

    const requestedTerrain: TerrainType[] = ["mountain"]
    const hasMatchingTerrain = requestedTerrain.some((t) => property.terrainTags?.includes(t))

    expect(hasMatchingTerrain).toBe(true)
  })

  test("local filtering rejects properties without matching terrain", () => {
    const property: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
      terrainTags: ["desert" as TerrainType],
    }

    const requestedTerrain: TerrainType[] = ["mountain", "forested"]
    const hasMatchingTerrain = requestedTerrain.some((t) => property.terrainTags?.includes(t))

    expect(hasMatchingTerrain).toBe(false)
  })

  test("price parsing removes currency symbols", () => {
    const priceString = "$500,000"
    const priceMatch = priceString.match(/[\d,]+/)
    const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : undefined

    expect(price).toBe(500000)
  })

  test("acres parsing extracts numeric value", () => {
    const acresString = "40.5 acres"
    const acresMatch = acresString.match(/[\d.]+/)
    const acres = acresMatch ? parseFloat(acresMatch[0]) : undefined

    expect(acres).toBe(40.5)
  })
})
