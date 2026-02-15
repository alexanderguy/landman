import type { Coordinates, WaterType, StructureType, TerrainType } from "./types"

export type Property = {
  // REQUIRED - plugins must provide these fields
  id: string
  source: string
  source_id: string
  url: string
  title: string

  // OPTIONAL - core attributes
  description?: string
  acres?: number
  price?: number

  // OPTIONAL - location
  state?: string
  county?: string
  city?: string
  address?: string
  coordinates?: Coordinates

  // OPTIONAL - features
  waterFeatures?: {
    hasWater: boolean
    types?: WaterType[]
    yearRound?: boolean
  }

  structures?: {
    hasStructures: boolean
    type?: StructureType
    count?: number
  }

  utilities?: {
    power?: boolean
    water?: boolean
    sewer?: boolean
    internet?: boolean
    gas?: boolean
  }

  distanceToTownMinutes?: number
  terrainTags?: TerrainType[]

  // OPTIONAL - metadata
  images?: string[]
  rawData?: unknown

  // CALCULATED - added by system, not by plugins
  score?: number
  fieldCompleteness?: number

  // TIMESTAMPS - managed by repository
  firstSeen?: string
  lastSeen?: string
  lastChecked?: string
}

export function calculateFieldCompleteness(property: Property): number {
  let count = 0

  // Count required fields (always present)
  count += 5 // id, source, source_id, url, title

  // Count optional core attributes
  if (property.description) count++
  if (property.acres !== undefined) count++
  if (property.price !== undefined) count++

  // Count location fields
  if (property.state) count++
  if (property.county) count++
  if (property.city) count++
  if (property.address) count++
  if (property.coordinates) count++

  // Count water features
  if (property.waterFeatures?.hasWater) {
    count++
    if (property.waterFeatures.types && property.waterFeatures.types.length > 0) count++
    if (property.waterFeatures.yearRound !== undefined) count++
  }

  // Count structures
  if (property.structures?.hasStructures !== undefined) {
    count++
    if (property.structures.type) count++
    if (property.structures.count !== undefined) count++
  }

  // Count utilities
  if (property.utilities) {
    if (property.utilities.power !== undefined) count++
    if (property.utilities.water !== undefined) count++
    if (property.utilities.sewer !== undefined) count++
    if (property.utilities.internet !== undefined) count++
    if (property.utilities.gas !== undefined) count++
  }

  // Count other features
  if (property.distanceToTownMinutes !== undefined) count++
  if (property.terrainTags && property.terrainTags.length > 0) count++
  if (property.images && property.images.length > 0) count++

  // Do NOT count: rawData, score, fieldCompleteness, timestamps
  return count
}

export function compareProperties(a: Property, b: Property): boolean {
  // Compare all fields except rawData, calculated fields, and timestamps
  // Returns true if properties differ

  // Required fields
  if (a.id !== b.id) return true
  if (a.source !== b.source) return true
  if (a.source_id !== b.source_id) return true
  if (a.url !== b.url) return true
  if (a.title !== b.title) return true

  // Optional core attributes
  if (a.description !== b.description) return true
  if (a.acres !== b.acres) return true
  if (a.price !== b.price) return true

  // Location
  if (a.state !== b.state) return true
  if (a.county !== b.county) return true
  if (a.city !== b.city) return true
  if (a.address !== b.address) return true

  // Coordinates (deep compare)
  if (JSON.stringify(a.coordinates) !== JSON.stringify(b.coordinates)) return true

  // Water features (deep compare)
  if (JSON.stringify(a.waterFeatures) !== JSON.stringify(b.waterFeatures)) return true

  // Structures (deep compare)
  if (JSON.stringify(a.structures) !== JSON.stringify(b.structures)) return true

  // Utilities (deep compare)
  if (JSON.stringify(a.utilities) !== JSON.stringify(b.utilities)) return true

  // Other features
  if (a.distanceToTownMinutes !== b.distanceToTownMinutes) return true

  // Terrain tags (deep compare)
  if (JSON.stringify(a.terrainTags) !== JSON.stringify(b.terrainTags)) return true

  // Images (deep compare)
  if (JSON.stringify(a.images) !== JSON.stringify(b.images)) return true

  // No differences found
  return false
}
