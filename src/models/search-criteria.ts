import type { TerrainType } from "./types"

export type WaterPreferenceType =
  | "year-round-water"
  | "pond-lake"
  | "well"
  | "creek"
  | "any-water"

export type StructurePreference = "raw-land" | "with-cabin" | "with-house" | "any"

export type SearchCriteria = {
  // Hard constraints
  minAcres: number
  maxAcres?: number
  states: string[]

  priceRange: {
    default: {
      min?: number
      max?: number
    }
    byRegion?: Record<
      string,
      {
        min?: number
        max?: number
      }
    >
  }

  distanceToTown?: {
    min: number
    max: number
    unit: "minutes"
  }

  // Weighted preferences (for scoring)
  waterPreferences?: Array<{
    type: WaterPreferenceType
    weight: number
  }>

  structurePreference?: StructurePreference

  terrain?: TerrainType[]

  utilityWeights?: {
    power?: number
    water?: number
    internet?: number
    sewer?: number
  }
}

export type PluginConfig = {
  enabled: boolean
  priority: number
}

export type Profile = {
  name: string
  description: string
  criteria: SearchCriteria
  plugins: Record<string, PluginConfig>
}

export type ScrapingConfig = {
  defaultRateLimitMs: number
  headless: boolean
  userAgent: string
}

export type ConfigFile = {
  profiles: Record<string, Profile>
  activeProfile: string
  scraping: ScrapingConfig
}
