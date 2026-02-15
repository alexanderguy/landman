import { test, expect } from "bun:test"
import type { Property } from "../../src/models/property"
import mlsMatcherPlugin from "../../src/plugins/deduplication/mls-matcher"
import coordinateMatcherPlugin from "../../src/plugins/deduplication/coordinate-matcher"

test("MLS matcher finds exact matches", async () => {
  const property: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://example.com/1",
    title: "Property 1",
    rawData: { mlsNumber: "MLS12345" },
  }

  const candidates: Property[] = [
    {
      id: "prop2",
      source: "zillow",
      source_id: "456",
      url: "https://example.com/2",
      title: "Property 2",
      rawData: { mls: "MLS12345" },
    },
    {
      id: "prop3",
      source: "zillow",
      source_id: "789",
      url: "https://example.com/3",
      title: "Property 3",
      rawData: { mls_number: "MLS99999" },
    },
  ]

  const matches = await mlsMatcherPlugin.findDuplicates(property, candidates)

  expect(matches.length).toBe(1)
  expect(matches[0]?.propertyId).toBe("prop2")
  expect(matches[0]?.confidence).toBe(1.0)
})

test("MLS matcher returns empty when no MLS number", async () => {
  const property: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://example.com/1",
    title: "Property 1",
  }

  const candidates: Property[] = [
    {
      id: "prop2",
      source: "zillow",
      source_id: "456",
      url: "https://example.com/2",
      title: "Property 2",
      rawData: { mls: "MLS12345" },
    },
  ]

  const matches = await mlsMatcherPlugin.findDuplicates(property, candidates)

  expect(matches.length).toBe(0)
})

test("coordinate matcher finds exact location matches", async () => {
  const property: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://example.com/1",
    title: "Property 1",
    coordinates: { latitude: 45.5231, longitude: -122.6765 },
  }

  const candidates: Property[] = [
    {
      id: "prop2",
      source: "zillow",
      source_id: "456",
      url: "https://example.com/2",
      title: "Property 2",
      coordinates: { latitude: 45.5231, longitude: -122.6765 },
    },
    {
      id: "prop3",
      source: "zillow",
      source_id: "789",
      url: "https://example.com/3",
      title: "Property 3",
      coordinates: { latitude: 46.0, longitude: -123.0 },
    },
  ]

  const matches = await coordinateMatcherPlugin.findDuplicates(property, candidates)

  expect(matches.length).toBe(1)
  expect(matches[0]?.propertyId).toBe("prop2")
  expect(matches[0]?.confidence).toBe(1.0)
})

test("coordinate matcher finds close matches with lower confidence", async () => {
  const property: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://example.com/1",
    title: "Property 1",
    coordinates: { latitude: 45.5231, longitude: -122.6765 },
  }

  const candidates: Property[] = [
    {
      id: "prop2",
      source: "zillow",
      source_id: "456",
      url: "https://example.com/2",
      title: "Property 2",
      coordinates: { latitude: 45.5235, longitude: -122.6770 },
    },
  ]

  const matches = await coordinateMatcherPlugin.findDuplicates(property, candidates)

  expect(matches.length).toBeGreaterThan(0)
  expect(matches[0]?.confidence).toBeGreaterThan(0)
  expect(matches[0]?.confidence).toBeLessThanOrEqual(1.0)
})

test("coordinate matcher returns empty when no coordinates", async () => {
  const property: Property = {
    id: "prop1",
    source: "landwatch",
    source_id: "123",
    url: "https://example.com/1",
    title: "Property 1",
  }

  const candidates: Property[] = [
    {
      id: "prop2",
      source: "zillow",
      source_id: "456",
      url: "https://example.com/2",
      title: "Property 2",
      coordinates: { latitude: 45.5231, longitude: -122.6765 },
    },
  ]

  const matches = await coordinateMatcherPlugin.findDuplicates(property, candidates)

  expect(matches.length).toBe(0)
})
