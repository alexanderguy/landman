import type { Property } from "../models/property"
import type { SearchCriteria, Profile } from "../models/search-criteria"
import type { PropertySource, SearchCallbacks } from "../plugins/types"
import type { PropertyRepository, SearchRunMetadata } from "../db/repository"
import { getAllPropertySources, getAllDeduplicationPlugins } from "../plugins/registry"
import { calculatePropertyScore } from "./scoring"
import { calculateFieldCompleteness } from "../models/property"
import { logger } from "../utils/logger"
import { createBrowserPool } from "../utils/browser-pool"

export type SearchEngineOptions = {
  repository: PropertyRepository
  profile: Profile
  callbacks?: SearchCallbacks
}

export type SearchResult = {
  propertiesFound: number
  sourcesUsed: string[]
  filtersApplied: Record<string, string[]>
  errors: string[]
}

export async function runSearch(options: SearchEngineOptions): Promise<SearchResult> {
  const { repository, profile, callbacks } = options
  const { criteria, plugins: pluginConfig } = profile

  const startedAt = new Date().toISOString()
  const sourcesUsed: string[] = []
  const filtersApplied: Record<string, string[]> = {}
  const errors: string[] = []
  let propertiesFound = 0

  const enabledSources = getEnabledSources(pluginConfig)

  if (enabledSources.length === 0) {
    logger.warn("No enabled property sources found")
    return {
      propertiesFound: 0,
      sourcesUsed: [],
      filtersApplied: {},
      errors: ["No enabled property sources"],
    }
  }

  logSupportedFilters(enabledSources)

  const allProperties: Property[] = []

  // Create shared browser pool for all sources
  logger.info(`Creating shared browser for ${enabledSources.length} sources...`)
  const browserPool = await createBrowserPool({ headless: false, stealth: true })

  try {
    // Run all sources in parallel using the shared browser
    logger.info(`Running ${enabledSources.length} sources in parallel...`)
    
    const searchPromises = enabledSources.map(async (source, i) => {
      try {
        logger.progress(
          `Searching ${source.metadata.displayName}...`,
          i + 1,
          enabledSources.length,
        )
        sourcesUsed.push(source.metadata.name)

        const supported = getSupportedFiltersList(source)
        filtersApplied[source.metadata.name] = supported

        const properties = await searchSource(source, criteria, callbacks, browserPool)
        
        logger.success(`Found ${properties.length} properties from ${source.metadata.displayName}`)
        
        return { properties, source: source.metadata.name }
      } catch (error) {
        const message = `Error searching ${source.metadata.name}: ${error}`
        logger.error(message)
        errors.push(message)
        callbacks?.onError?.(error as Error)
        return { properties: [], source: source.metadata.name }
      }
    })

    const results = await Promise.all(searchPromises)
    
    for (const result of results) {
      allProperties.push(...result.properties)
      propertiesFound += result.properties.length
    }
  } finally {
    // Always close the shared browser
    await browserPool.close()
  }

  const scoredProperties = scoreProperties(allProperties, criteria)

  for (const property of scoredProperties) {
    repository.saveProperty(property)
  }

  await runDeduplication(scoredProperties, repository)

  const completedAt = new Date().toISOString()

  const metadata: SearchRunMetadata = {
    profileName: profile.name,
    startedAt,
    completedAt,
    propertiesFound,
    sourcesUsed,
    filtersApplied,
    criteriaSnapshot: criteria,
    errors: errors.length > 0 ? errors : undefined,
  }

  repository.recordSearchRun(metadata)

  return {
    propertiesFound,
    sourcesUsed,
    filtersApplied,
    errors,
  }
}

function getEnabledSources(pluginConfig: Record<string, { enabled: boolean; priority: number }>): PropertySource[] {
  const allSources = getAllPropertySources()

  const enabled = allSources
    .filter((source) => {
      const config = pluginConfig[source.metadata.name]
      return config?.enabled === true
    })
    .map((source) => {
      const priority = pluginConfig[source.metadata.name]?.priority ?? 0
      return { source, priority }
    })
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.source)

  return enabled
}

function logSupportedFilters(sources: PropertySource[]): void {
  logger.info("Filter support by source:")
  for (const source of sources) {
    const supported = getSupportedFiltersList(source)
    logger.info(`  ${source.metadata.displayName}: ${supported.join(", ")}`)
  }
}

function getSupportedFiltersList(source: PropertySource): string[] {
  const { supportedFilters } = source.metadata
  const supported: string[] = []

  if (supportedFilters.states) supported.push("states")
  if (supportedFilters.priceRange) supported.push("priceRange")
  if (supportedFilters.acreageRange) supported.push("acreageRange")
  if (supportedFilters.waterFeatures) supported.push("waterFeatures")
  if (supportedFilters.structures) supported.push("structures")
  if (supportedFilters.terrain) supported.push("terrain")
  if (supportedFilters.distanceToTown) supported.push("distanceToTown")

  return supported
}

async function searchSource(
  source: PropertySource,
  criteria: SearchCriteria,
  callbacks?: SearchCallbacks,
  browserPool?: any,
): Promise<Property[]> {
  const properties: Property[] = []

  for await (const property of source.search(criteria, { callbacks, browserPool })) {
    properties.push(property)
    callbacks?.onPropertyFound?.(property)
  }

  return properties
}

function scoreProperties(properties: Property[], criteria: SearchCriteria): Property[] {
  return properties.map((property) => ({
    ...property,
    score: calculatePropertyScore(property, criteria),
    fieldCompleteness: calculateFieldCompleteness(property),
  }))
}

async function runDeduplication(
  properties: Property[],
  repository: PropertyRepository,
): Promise<void> {
  const dedupPlugins = getAllDeduplicationPlugins()

  if (dedupPlugins.length === 0) {
    return
  }

  for (const property of properties) {
    for (const plugin of dedupPlugins) {
      const matches = await plugin.findDuplicates(property, properties)

      for (const match of matches) {
        const canonicalId = selectCanonical(property, properties.find((p) => p.id === match.propertyId)!)

        repository.markDuplicates(
          canonicalId,
          [property.id, match.propertyId],
          plugin.name,
          match.confidence,
        )
      }
    }
  }
}

function selectCanonical(a: Property, b: Property): string {
  const aCompleteness = a.fieldCompleteness ?? 0
  const bCompleteness = b.fieldCompleteness ?? 0

  if (aCompleteness > bCompleteness) {
    return a.id
  }

  if (bCompleteness > aCompleteness) {
    return b.id
  }

  return a.id < b.id ? a.id : b.id
}
