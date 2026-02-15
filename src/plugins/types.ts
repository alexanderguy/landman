import type { Property } from "../models/property"
import type { SearchCriteria } from "../models/search-criteria"
import type { BrowserPool } from "../utils/browser-pool"

export type SearchCallbacks = {
  onProgress?: (message: string) => void
  onError?: (error: Error) => void
  onPropertyFound?: (property: Property) => void
}

export type SearchOptions = {
  callbacks?: SearchCallbacks
  browserPool?: BrowserPool
}

export type SupportedFilters = {
  states?: boolean
  priceRange?: boolean
  acreageRange?: boolean
  waterFeatures?: boolean
  structures?: boolean
  terrain?: boolean
  distanceToTown?: boolean
}

export type PluginMetadata = {
  name: string
  displayName: string
  version: string
  description: string
  supportedFilters: SupportedFilters
}

export type PropertySource = {
  metadata: PluginMetadata
  search(
    criteria: SearchCriteria,
    options?: SearchOptions,
  ): AsyncGenerator<Property, void, unknown>
}

export type DuplicateMatch = {
  propertyId: string
  confidence: number
}

export type DeduplicationPlugin = {
  name: string
  findDuplicates(property: Property, candidates: Property[]): Promise<DuplicateMatch[]>
}
