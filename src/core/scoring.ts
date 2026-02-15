import type { Property } from "../models/property"
import type { SearchCriteria, WaterPreferenceType } from "../models/search-criteria"

export function calculatePropertyScore(property: Property, criteria: SearchCriteria): number {
  let score = 0

  score += scoreWaterFeatures(property, criteria)
  score += scoreStructures(property, criteria)
  score += scoreTerrain(property, criteria)
  score += scoreUtilities(property, criteria)
  score += scoreDistanceToTown(property, criteria)

  return Math.round(score * 100) / 100
}

function scoreWaterFeatures(property: Property, criteria: SearchCriteria): number {
  if (!criteria.waterPreferences || criteria.waterPreferences.length === 0) {
    return 0
  }

  if (!property.waterFeatures?.hasWater) {
    return 0
  }

  let waterScore = 0

  for (const preference of criteria.waterPreferences) {
    const match = matchesWaterPreference(property, preference.type)
    if (match) {
      waterScore += preference.weight
    }
  }

  return waterScore
}

function matchesWaterPreference(property: Property, preferenceType: WaterPreferenceType): boolean {
  if (!property.waterFeatures?.hasWater) {
    return false
  }

  switch (preferenceType) {
    case "year-round-water":
      return property.waterFeatures.yearRound === true

    case "pond-lake":
      return (
        property.waterFeatures.types?.includes("pond") === true ||
        property.waterFeatures.types?.includes("lake") === true
      )

    case "well":
      return property.waterFeatures.types?.includes("well") === true

    case "creek":
      return (
        property.waterFeatures.types?.includes("creek") === true ||
        property.waterFeatures.types?.includes("river") === true ||
        property.waterFeatures.types?.includes("spring") === true
      )

    case "any-water":
      return true

    default:
      return false
  }
}

function scoreStructures(property: Property, criteria: SearchCriteria): number {
  if (!criteria.structurePreference || criteria.structurePreference === "any") {
    return 0
  }

  const hasStructures = property.structures?.hasStructures === true

  switch (criteria.structurePreference) {
    case "raw-land":
      return hasStructures ? 0 : 10

    case "with-cabin":
      return hasStructures && property.structures?.type === "cabin" ? 15 : 0

    case "with-house":
      return hasStructures && property.structures?.type === "house" ? 15 : 0

    default:
      return 0
  }
}

function scoreTerrain(property: Property, criteria: SearchCriteria): number {
  if (!criteria.terrain || criteria.terrain.length === 0) {
    return 0
  }

  if (!property.terrainTags || property.terrainTags.length === 0) {
    return 0
  }

  const matchCount = criteria.terrain.filter((preferredTerrain) =>
    property.terrainTags?.includes(preferredTerrain),
  ).length

  return matchCount * 5
}

function scoreUtilities(property: Property, criteria: SearchCriteria): number {
  if (!criteria.utilityWeights || !property.utilities) {
    return 0
  }

  let utilityScore = 0

  if (criteria.utilityWeights.power !== undefined && property.utilities.power === true) {
    utilityScore += criteria.utilityWeights.power
  }

  if (criteria.utilityWeights.water !== undefined && property.utilities.water === true) {
    utilityScore += criteria.utilityWeights.water
  }

  if (criteria.utilityWeights.internet !== undefined && property.utilities.internet === true) {
    utilityScore += criteria.utilityWeights.internet
  }

  if (criteria.utilityWeights.sewer !== undefined && property.utilities.sewer === true) {
    utilityScore += criteria.utilityWeights.sewer
  }

  return utilityScore
}

function scoreDistanceToTown(property: Property, criteria: SearchCriteria): number {
  if (!criteria.distanceToTown || property.distanceToTownMinutes === undefined) {
    return 0
  }

  const distance = property.distanceToTownMinutes
  const { min, max } = criteria.distanceToTown

  if (distance < min) {
    return -10
  }

  if (distance > max) {
    return -5
  }

  const midpoint = (min + max) / 2
  const range = max - min

  if (range === 0) {
    return distance === midpoint ? 10 : 0
  }

  const deviation = Math.abs(distance - midpoint) / (range / 2)
  const score = 10 * (1 - deviation)

  return Math.max(0, score)
}
