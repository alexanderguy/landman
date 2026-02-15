import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { DatabaseClient } from "../../src/db/client"
import { PropertyRepository } from "../../src/db/repository"
import { runMigrations } from "../../src/db/migrations"
import type { Property } from "../../src/models/property"
import { generatePropertyId } from "../../src/utils/hash"

const TEST_DB_PATH = ":memory:"

describe("Price tracking", () => {
  let db: DatabaseClient
  let repo: PropertyRepository

  beforeEach(async () => {
    db = new DatabaseClient(TEST_DB_PATH)
    await runMigrations(db)
    repo = new PropertyRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  test("saves initial property without price history", () => {
    const property: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "Test Property",
      price: 500000,
    }

    repo.saveProperty(property)

    const priceHistory = repo.getPriceChanges(property.id)
    expect(priceHistory.length).toBe(0)
  })

  test("records price change when property is updated", () => {
    const property1: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "Test Property",
      price: 500000,
    }

    repo.saveProperty(property1)

    const property2: Property = {
      ...property1,
      price: 450000,
    }

    repo.saveProperty(property2)

    const priceHistory = repo.getPriceChanges(property1.id)
    expect(priceHistory.length).toBe(1)
    expect(priceHistory[0]?.price).toBe(450000)
  })

  test("does not record price history when price unchanged", () => {
    const property1: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "Test Property",
      price: 500000,
    }

    repo.saveProperty(property1)

    const property2: Property = {
      ...property1,
      title: "Updated Title",
    }

    repo.saveProperty(property2)

    const priceHistory = repo.getPriceChanges(property1.id)
    expect(priceHistory.length).toBe(0)
  })

  test("tracks multiple price changes", () => {
    const baseProperty: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "Test Property",
      price: 500000,
    }

    repo.saveProperty(baseProperty)

    repo.saveProperty({ ...baseProperty, price: 450000 })
    repo.saveProperty({ ...baseProperty, price: 475000 })
    repo.saveProperty({ ...baseProperty, price: 425000 })

    const priceHistory = repo.getPriceChanges(baseProperty.id)
    expect(priceHistory.length).toBe(3)
    
    const prices = priceHistory.map(p => p.price).sort((a, b) => b - a)
    expect(prices).toEqual([475000, 450000, 425000])
  })

  test("identifies new properties since date", () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const property: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "New Property",
    }

    repo.saveProperty(property)

    const newProps = repo.getNewProperties(yesterday)
    expect(newProps.length).toBe(1)

    const noNewProps = repo.getNewProperties(tomorrow)
    expect(noNewProps.length).toBe(0)
  })

  test("gets properties with price changes since date", () => {
    const property1: Property = {
      id: generatePropertyId("test", "123"),
      source: "test",
      source_id: "123",
      url: "https://example.com/123",
      title: "Property 1",
      price: 500000,
    }

    const property2: Property = {
      id: generatePropertyId("test", "456"),
      source: "test",
      source_id: "456",
      url: "https://example.com/456",
      title: "Property 2",
      price: 300000,
    }

    repo.saveProperty(property1)
    repo.saveProperty(property2)

    repo.saveProperty({ ...property1, price: 450000 })

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const changedProps = repo.getPropertiesWithPriceChanges(yesterday)

    expect(changedProps.length).toBe(1)
    expect(changedProps[0]?.id).toBe(property1.id)
  })

  test("retrieves last search date", () => {
    const result = repo.getLastSearchDate()
    expect(result).toBeNull()

    const searchRun = {
      profileName: "test",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      propertiesFound: 10,
      sourcesUsed: ["test"],
      filtersApplied: {},
      criteriaSnapshot: {
        states: ["MT"],
        minAcres: 20,
        priceRange: { default: {} },
        waterPreferences: [],
      },
    }

    repo.recordSearchRun(searchRun)

    const lastSearch = repo.getLastSearchDate()
    expect(lastSearch).toBeDefined()
    expect(lastSearch).toBe(searchRun.completedAt)
  })

  test("filters last search date by profile", () => {
    const run1 = {
      profileName: "profile1",
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() - 60000).toISOString(),
      propertiesFound: 5,
      sourcesUsed: ["test"],
      filtersApplied: {},
      criteriaSnapshot: { states: ["MT"], minAcres: 20, priceRange: { default: {} }, waterPreferences: [] },
    }

    const run2 = {
      profileName: "profile2",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      propertiesFound: 10,
      sourcesUsed: ["test"],
      filtersApplied: {},
      criteriaSnapshot: { states: ["ID"], minAcres: 20, priceRange: { default: {} }, waterPreferences: [] },
    }

    repo.recordSearchRun(run1)
    repo.recordSearchRun(run2)

    const lastSearch1 = repo.getLastSearchDate("profile1")
    const lastSearch2 = repo.getLastSearchDate("profile2")

    expect(lastSearch1).toBe(run1.completedAt)
    expect(lastSearch2).toBe(run2.completedAt)
  })
})
