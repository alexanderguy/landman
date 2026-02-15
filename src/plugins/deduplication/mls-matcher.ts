import type { DeduplicationPlugin, DuplicateMatch } from "../types"
import type { Property } from "../../models/property"

function extractMLSNumber(property: Property): string | null {
  if (!property.rawData || typeof property.rawData !== "object") {
    return null
  }

  const raw = property.rawData as Record<string, unknown>

  if (typeof raw.mlsNumber === "string" && raw.mlsNumber.length > 0) {
    return raw.mlsNumber.toUpperCase().trim()
  }

  if (typeof raw.mls_number === "string" && raw.mls_number.length > 0) {
    return raw.mls_number.toUpperCase().trim()
  }

  if (typeof raw.mls === "string" && raw.mls.length > 0) {
    return raw.mls.toUpperCase().trim()
  }

  const description = property.description?.toUpperCase() ?? ""
  const mlsMatch = description.match(/MLS[#:\s]*([A-Z0-9-]+)/i)
  if (mlsMatch && mlsMatch[1]) {
    return mlsMatch[1].toUpperCase().trim()
  }

  return null
}

const mlsMatcherPlugin: DeduplicationPlugin = {
  name: "mls-matcher",

  async findDuplicates(property: Property, candidates: Property[]): Promise<DuplicateMatch[]> {
    const propertyMLS = extractMLSNumber(property)

    if (!propertyMLS) {
      return []
    }

    const matches: DuplicateMatch[] = []

    for (const candidate of candidates) {
      if (candidate.id === property.id) {
        continue
      }

      const candidateMLS = extractMLSNumber(candidate)

      if (candidateMLS && candidateMLS === propertyMLS) {
        matches.push({
          propertyId: candidate.id,
          confidence: 1.0,
        })
      }
    }

    return matches
  },
}

export default mlsMatcherPlugin
