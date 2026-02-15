import type { DeduplicationPlugin, DuplicateMatch } from "../types"
import type { Property } from "../../models/property"
import type { Coordinates } from "../../models/types"

function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3
  const φ1 = (coord1.latitude * Math.PI) / 180
  const φ2 = (coord2.latitude * Math.PI) / 180
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

const EXACT_MATCH_THRESHOLD = 10
const VERY_CLOSE_THRESHOLD = 50
const CLOSE_THRESHOLD = 100

const coordinateMatcherPlugin: DeduplicationPlugin = {
  name: "coordinate-matcher",

  async findDuplicates(property: Property, candidates: Property[]): Promise<DuplicateMatch[]> {
    if (!property.coordinates) {
      return []
    }

    const matches: DuplicateMatch[] = []

    for (const candidate of candidates) {
      if (candidate.id === property.id || !candidate.coordinates) {
        continue
      }

      const distance = haversineDistance(property.coordinates, candidate.coordinates)

      let confidence = 0

      if (distance <= EXACT_MATCH_THRESHOLD) {
        confidence = 1.0
      } else if (distance <= VERY_CLOSE_THRESHOLD) {
        confidence = 0.9
      } else if (distance <= CLOSE_THRESHOLD) {
        confidence = 0.7
      }

      if (confidence > 0) {
        matches.push({
          propertyId: candidate.id,
          confidence,
        })
      }
    }

    return matches
  },
}

export default coordinateMatcherPlugin
