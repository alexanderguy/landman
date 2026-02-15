import { test, expect, beforeEach, afterEach } from "bun:test"
import { DatabaseClient } from "../../src/db/client"
import { PropertyRepository } from "../../src/db/repository"
import { runMigrations } from "../../src/db/migrations"
import type { Property } from "../../src/models/property"
import { unlinkSync } from "fs"

const TEST_DB_PATH = ":memory:"

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

test("saveProperty inserts new property", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com/property/123",
    title: "Test Property",
    price: 500000,
    acres: 40,
    state: "MT",
  }

  repo.saveProperty(property)

  const saved = repo.findById("test123")
  expect(saved).toBeDefined()
  expect(saved?.title).toBe("Test Property")
  expect(saved?.price).toBe(500000)
})

test("saveProperty creates snapshot on insert", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com/property/123",
    title: "Test Property",
    price: 500000,
  }

  repo.saveProperty(property)

  const snapshots = repo.getPropertySnapshots("test123")
  expect(snapshots.length).toBe(1)
  expect(snapshots[0].price).toBe(500000)
})

test("saveProperty creates snapshot on change", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com/property/123",
    title: "Test Property",
    price: 500000,
  }

  repo.saveProperty(property)

  const updated = { ...property, price: 450000 }
  repo.saveProperty(updated)

  const snapshots = repo.getPropertySnapshots("test123")
  expect(snapshots.length).toBe(2)
  expect(snapshots[0].price).toBe(450000)
  expect(snapshots[1].price).toBe(500000)
})

test("saveProperty does not create snapshot when no changes", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com/property/123",
    title: "Test Property",
    price: 500000,
  }

  repo.saveProperty(property)
  repo.saveProperty(property)

  const snapshots = repo.getPropertySnapshots("test123")
  expect(snapshots.length).toBe(1)
})

test("saveProperty records price change", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com/property/123",
    title: "Test Property",
    price: 500000,
  }

  repo.saveProperty(property)

  const updated = { ...property, price: 450000 }
  repo.saveProperty(updated)

  const priceChanges = repo.getPriceChanges("test123")
  expect(priceChanges.length).toBe(1)
  expect(priceChanges[0].price).toBe(450000)
})

test("findProperties filters by state", () => {
  const mt1: Property = {
    id: "mt1",
    source: "test",
    source_id: "1",
    url: "https://example.com/1",
    title: "Montana Property 1",
    state: "MT",
  }

  const id1: Property = {
    id: "id1",
    source: "test",
    source_id: "2",
    url: "https://example.com/2",
    title: "Idaho Property 1",
    state: "ID",
  }

  repo.saveProperty(mt1)
  repo.saveProperty(id1)

  const mtProperties = repo.findProperties({ state: "MT" })
  expect(mtProperties.length).toBe(1)
  expect(mtProperties[0].state).toBe("MT")
})

test("findProperties filters by price range", () => {
  const cheap: Property = {
    id: "cheap",
    source: "test",
    source_id: "1",
    url: "https://example.com/1",
    title: "Cheap Property",
    price: 200000,
  }

  const expensive: Property = {
    id: "expensive",
    source: "test",
    source_id: "2",
    url: "https://example.com/2",
    title: "Expensive Property",
    price: 1000000,
  }

  repo.saveProperty(cheap)
  repo.saveProperty(expensive)

  const affordable = repo.findProperties({ maxPrice: 500000 })
  expect(affordable.length).toBe(1)
  expect(affordable[0].price).toBe(200000)
})

test("markDuplicates creates links", () => {
  const prop1: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://landwatch.com/123",
    title: "Property 1",
  }

  const prop2: Property = {
    id: "prop2",
    source: "zillow",
    source_id: "456",
    url: "https://zillow.com/456",
    title: "Property 1",
  }

  repo.saveProperty(prop1)
  repo.saveProperty(prop2)

  repo.markDuplicates("prop1", ["prop2"], "coordinates", 0.9)

  const rows = db.query("SELECT * FROM property_duplicates WHERE canonical_id = ?", ["prop1"])
  expect(rows.length).toBe(1)
})
