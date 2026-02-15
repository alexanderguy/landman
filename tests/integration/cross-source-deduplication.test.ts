import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import type { Property } from "../../src/models/property"
import { generatePropertyId } from "../../src/utils/hash"
import { calculateFieldCompleteness } from "../../src/models/property"
import mlsMatcherPlugin from "../../src/plugins/deduplication/mls-matcher"
import coordinateMatcherPlugin from "../../src/plugins/deduplication/coordinate-matcher"
import { DatabaseClient } from "../../src/db/client"
import { runMigrations } from "../../src/db/migrations"
import { PropertyRepository } from "../../src/db/repository"

const TEST_DB_PATH = ":memory:"

describe("Cross-source deduplication", () => {
  let db: DatabaseClient
  let repository: PropertyRepository

  beforeEach(async () => {
    db = new DatabaseClient(TEST_DB_PATH)
    await runMigrations(db)
    repository = new PropertyRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  test("MLS matcher identifies duplicates across LandWatch and Lands of America", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "12345"),
      source: "landwatch",
      source_id: "12345",
      url: "https://www.landwatch.com/montana-land-for-sale/12345",
      title: "40 Acres in Madison County, MT",
      price: 500000,
      acres: 40,
      state: "MT",
      county: "Madison",
      rawData: { mlsNumber: "MLS98765" },
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "67890"),
      source: "landsofamerica",
      source_id: "67890",
      url: "https://www.landsofamerica.com/property/montana-land/67890",
      title: "Madison County Montana Land",
      price: 495000,
      acres: 40.5,
      state: "MT",
      county: "Madison",
      description: "Beautiful mountain property with year-round access",
      rawData: { mls: "MLS98765" },
    }

    const matches = await mlsMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])

    expect(matches.length).toBe(1)
    expect(matches[0]?.propertyId).toBe(loaProperty.id)
    expect(matches[0]?.confidence).toBe(1.0)
  })

  test("coordinate matcher identifies duplicates across sources", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "11111"),
      source: "landwatch",
      source_id: "11111",
      url: "https://www.landwatch.com/montana-land-for-sale/11111",
      title: "Mountain Property",
      price: 300000,
      coordinates: { latitude: 45.6789, longitude: -111.2345 },
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "22222"),
      source: "landsofamerica",
      source_id: "22222",
      url: "https://www.landsofamerica.com/property/montana-land/22222",
      title: "Scenic Montana Land",
      price: 295000,
      coordinates: { latitude: 45.6789, longitude: -111.2345 },
    }

    const matches = await coordinateMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])

    expect(matches.length).toBe(1)
    expect(matches[0]?.propertyId).toBe(loaProperty.id)
    expect(matches[0]?.confidence).toBe(1.0)
  })

  test("coordinate matcher identifies nearby properties with lower confidence", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "33333"),
      source: "landwatch",
      source_id: "33333",
      url: "https://www.landwatch.com/montana-land-for-sale/33333",
      title: "Land Parcel A",
      coordinates: { latitude: 45.5000, longitude: -111.0000 },
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "44444"),
      source: "landsofamerica",
      source_id: "44444",
      url: "https://www.landsofamerica.com/property/montana-land/44444",
      title: "Land Parcel B",
      coordinates: { latitude: 45.5005, longitude: -111.0005 },
    }

    const matches = await coordinateMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.confidence).toBeGreaterThan(0)
    expect(matches[0]?.confidence).toBeLessThan(1.0)
  })

  test("canonical selection picks property with highest field completeness", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "55555"),
      source: "landwatch",
      source_id: "55555",
      url: "https://www.landwatch.com/montana-land-for-sale/55555",
      title: "Montana Property",
      price: 400000,
      acres: 50,
      state: "MT",
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "66666"),
      source: "landsofamerica",
      source_id: "66666",
      url: "https://www.landsofamerica.com/property/montana-land/66666",
      title: "Montana Property - Complete Listing",
      price: 400000,
      acres: 50,
      state: "MT",
      county: "Gallatin",
      city: "Bozeman",
      description: "Prime Montana land with mountain views",
      address: "123 Mountain Road",
      images: ["image1.jpg", "image2.jpg"],
    }

    const landwatchCompleteness = calculateFieldCompleteness(landwatchProperty)
    const loaCompleteness = calculateFieldCompleteness(loaProperty)

    expect(loaCompleteness).toBeGreaterThan(landwatchCompleteness)

    const canonicalProperty = loaCompleteness > landwatchCompleteness ? loaProperty : landwatchProperty

    expect(canonicalProperty.id).toBe(loaProperty.id)
    expect(canonicalProperty.source).toBe("landsofamerica")
  })

  test("deduplication preserves both properties in database", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "77777"),
      source: "landwatch",
      source_id: "77777",
      url: "https://www.landwatch.com/montana-land-for-sale/77777",
      title: "Test Property LW",
      rawData: { mls: "MLS11111" },
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "88888"),
      source: "landsofamerica",
      source_id: "88888",
      url: "https://www.landsofamerica.com/property/montana-land/88888",
      title: "Test Property LOA",
      description: "More complete listing",
      rawData: { mlsNumber: "MLS11111" },
    }

    repository.saveProperty(landwatchProperty)
    repository.saveProperty(loaProperty)

    const matches = await mlsMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])
    expect(matches.length).toBe(1)

    const loaCompleteness = calculateFieldCompleteness(loaProperty)
    const landwatchCompleteness = calculateFieldCompleteness(landwatchProperty)
    const canonicalId = loaCompleteness > landwatchCompleteness ? loaProperty.id : landwatchProperty.id
    const duplicateId = canonicalId === loaProperty.id ? landwatchProperty.id : loaProperty.id

    repository.markDuplicates(canonicalId, [duplicateId], "mls-matcher", 1.0)

    const savedLandwatch = repository.findById(landwatchProperty.id)
    const savedLoa = repository.findById(loaProperty.id)

    expect(savedLandwatch).toBeDefined()
    expect(savedLoa).toBeDefined()

    const duplicates = db.query<{ canonical_id: string; duplicate_id: string }>(
      "SELECT canonical_id, duplicate_id FROM property_duplicates WHERE canonical_id = ? OR duplicate_id = ?",
      [canonicalId, duplicateId]
    )
    expect(duplicates.length).toBeGreaterThan(0)
    expect(duplicates[0]?.canonical_id).toBe(canonicalId)
  })

  test("different sources with no matching identifiers are not linked", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "99999"),
      source: "landwatch",
      source_id: "99999",
      url: "https://www.landwatch.com/montana-land-for-sale/99999",
      title: "Unique Property A",
      price: 250000,
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "10101"),
      source: "landsofamerica",
      source_id: "10101",
      url: "https://www.landsofamerica.com/property/montana-land/10101",
      title: "Unique Property B",
      price: 350000,
    }

    const mlsMatches = await mlsMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])
    const coordMatches = await coordinateMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])

    expect(mlsMatches.length).toBe(0)
    expect(coordMatches.length).toBe(0)
  })

  test("both plugins can identify the same duplicate pair", async () => {
    const landwatchProperty: Property = {
      id: generatePropertyId("landwatch", "20202"),
      source: "landwatch",
      source_id: "20202",
      url: "https://www.landwatch.com/montana-land-for-sale/20202",
      title: "Premium Land",
      coordinates: { latitude: 46.1234, longitude: -112.5678 },
      rawData: { mlsNumber: "MLS55555" },
    }

    const loaProperty: Property = {
      id: generatePropertyId("landsofamerica", "30303"),
      source: "landsofamerica",
      source_id: "30303",
      url: "https://www.landsofamerica.com/property/montana-land/30303",
      title: "Premium Montana Property",
      coordinates: { latitude: 46.1234, longitude: -112.5678 },
      rawData: { mls: "MLS55555" },
    }

    const mlsMatches = await mlsMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])
    const coordMatches = await coordinateMatcherPlugin.findDuplicates(landwatchProperty, [loaProperty])

    expect(mlsMatches.length).toBe(1)
    expect(coordMatches.length).toBe(1)
    expect(mlsMatches[0]?.propertyId).toBe(loaProperty.id)
    expect(coordMatches[0]?.propertyId).toBe(loaProperty.id)
    expect(mlsMatches[0]?.confidence).toBe(1.0)
    expect(coordMatches[0]?.confidence).toBe(1.0)
  })
})
