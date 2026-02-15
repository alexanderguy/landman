import { test, expect, describe } from "bun:test"
import { calculatePropertyScore } from "../../src/core/scoring"
import type { Property } from "../../src/models/property"
import type { SearchCriteria } from "../../src/models/search-criteria"

const baseProperty: Property = {
  id: "test-1",
  source: "test",
  source_id: "1",
  url: "https://example.com/1",
  title: "Test Property",
}

const baseCriteria: SearchCriteria = {
  minAcres: 10,
  states: ["MT"],
  priceRange: {
    default: {
      max: 100000,
    },
  },
}

describe("calculatePropertyScore", () => {
  describe("water features", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      waterPreferences: [
        { type: "year-round-water", weight: 20 },
        { type: "pond-lake", weight: 15 },
      ],
    }

    test("scores year-round water", () => {
      const property: Property = {
        ...baseProperty,
        waterFeatures: {
          hasWater: true,
          types: ["pond"],
          yearRound: true,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(35)
    })

    test("scores pond without year-round", () => {
      const property: Property = {
        ...baseProperty,
        waterFeatures: {
          hasWater: true,
          types: ["pond"],
          yearRound: false,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(15)
    })

    test("no score for no water", () => {
      const property: Property = {
        ...baseProperty,
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(0)
    })
  })

  describe("structures", () => {
    test("prefers raw land", () => {
      const criteria: SearchCriteria = {
        ...baseCriteria,
        structurePreference: "raw-land",
      }

      const property: Property = {
        ...baseProperty,
        structures: {
          hasStructures: false,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(10)
    })

    test("prefers cabin", () => {
      const criteria: SearchCriteria = {
        ...baseCriteria,
        structurePreference: "with-cabin",
      }

      const property: Property = {
        ...baseProperty,
        structures: {
          hasStructures: true,
          type: "cabin",
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(15)
    })

    test("no score for wrong structure type", () => {
      const criteria: SearchCriteria = {
        ...baseCriteria,
        structurePreference: "with-cabin",
      }

      const property: Property = {
        ...baseProperty,
        structures: {
          hasStructures: true,
          type: "house",
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(0)
    })
  })

  describe("terrain", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      terrain: ["forested", "mountain"],
    }

    test("scores matching terrain", () => {
      const property: Property = {
        ...baseProperty,
        terrainTags: ["forested", "mountain"],
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(10)
    })

    test("scores partial terrain match", () => {
      const property: Property = {
        ...baseProperty,
        terrainTags: ["forested", "green"],
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(5)
    })

    test("no score for no terrain", () => {
      const property: Property = {
        ...baseProperty,
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(0)
    })
  })

  describe("utilities", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      utilityWeights: {
        power: 8,
        water: 5,
        internet: 3,
      },
    }

    test("scores all utilities", () => {
      const property: Property = {
        ...baseProperty,
        utilities: {
          power: true,
          water: true,
          internet: true,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(16)
    })

    test("scores only present utilities", () => {
      const property: Property = {
        ...baseProperty,
        utilities: {
          power: true,
          water: false,
          internet: true,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(11)
    })
  })

  describe("distance to town", () => {
    const criteria: SearchCriteria = {
      ...baseCriteria,
      distanceToTown: {
        min: 15,
        max: 45,
        unit: "minutes",
      },
    }

    test("scores ideal distance", () => {
      const property: Property = {
        ...baseProperty,
        distanceToTownMinutes: 30,
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(10)
    })

    test("penalizes too close", () => {
      const property: Property = {
        ...baseProperty,
        distanceToTownMinutes: 10,
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(-10)
    })

    test("penalizes too far", () => {
      const property: Property = {
        ...baseProperty,
        distanceToTownMinutes: 50,
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(-5)
    })
  })

  describe("combined scoring", () => {
    test("combines all scoring components", () => {
      const criteria: SearchCriteria = {
        ...baseCriteria,
        waterPreferences: [{ type: "year-round-water", weight: 20 }],
        structurePreference: "raw-land",
        terrain: ["forested"],
        utilityWeights: {
          power: 5,
        },
      }

      const property: Property = {
        ...baseProperty,
        waterFeatures: {
          hasWater: true,
          yearRound: true,
        },
        structures: {
          hasStructures: false,
        },
        terrainTags: ["forested"],
        utilities: {
          power: true,
        },
      }

      const score = calculatePropertyScore(property, criteria)
      expect(score).toBe(40)
    })
  })
})
