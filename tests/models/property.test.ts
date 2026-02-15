import { test, expect } from "bun:test"
import { calculateFieldCompleteness, compareProperties, type Property } from "../../src/models/property"

test("calculateFieldCompleteness counts all populated fields", () => {
  const minimalProperty: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com",
    title: "Test Property",
  }

  expect(calculateFieldCompleteness(minimalProperty)).toBe(5)

  const fullProperty: Property = {
    ...minimalProperty,
    description: "A great property",
    acres: 40,
    price: 500000,
    state: "MT",
    county: "Madison",
    city: "Ennis",
    address: "123 Mountain Rd",
    coordinates: { latitude: 45.0, longitude: -111.0 },
    waterFeatures: {
      hasWater: true,
      types: ["creek", "pond"],
      yearRound: true,
    },
    structures: {
      hasStructures: false,
      type: "raw-land",
    },
    utilities: {
      power: true,
      internet: false,
    },
    distanceToTownMinutes: 45,
    terrainTags: ["forested", "mountain"],
    images: ["img1.jpg", "img2.jpg"],
  }

  const count = calculateFieldCompleteness(fullProperty)
  expect(count).toBeGreaterThan(20)
})

test("compareProperties detects changes", () => {
  const property1: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com",
    title: "Test Property",
    price: 500000,
  }

  const property2: Property = {
    ...property1,
    price: 450000,
  }

  expect(compareProperties(property1, property2)).toBe(true)
})

test("compareProperties ignores rawData", () => {
  const property1: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com",
    title: "Test Property",
    rawData: { original: "data1" },
  }

  const property2: Property = {
    ...property1,
    rawData: { original: "data2" },
  }

  expect(compareProperties(property1, property2)).toBe(false)
})

test("compareProperties returns false for identical properties", () => {
  const property: Property = {
    id: "test123",
    source: "test",
    source_id: "123",
    url: "https://example.com",
    title: "Test Property",
    price: 500000,
  }

  expect(compareProperties(property, property)).toBe(false)
})
