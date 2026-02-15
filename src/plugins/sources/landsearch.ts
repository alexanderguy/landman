import type { PropertySource, PluginMetadata, SearchCallbacks } from "../types"
import type { SearchCriteria } from "../../models/search-criteria"
import type { Property } from "../../models/property"
import { generatePropertyId } from "../../utils/hash"
import { createRateLimiter, randomDelay } from "../../utils/rate-limiter"
import {
  launchBrowser,
  closeBrowser,
  navigateWithRetry,
  waitForSelector,
} from "../../utils/playwright-helpers"
import { logger } from "../../utils/logger"

const metadata: PluginMetadata = {
  name: "landsearch",
  displayName: "LandSearch",
  version: "1.0.0",
  description: "Scrapes property listings from LandSearch.com",
  supportedFilters: {
    states: true,
    priceRange: true,
    acreageRange: true,
    waterFeatures: false,
    structures: false,
    terrain: false,
    distanceToTown: false,
  },
}

const STATE_NAMES: Record<string, string> = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "new-hampshire",
  NJ: "new-jersey",
  NM: "new-mexico",
  NY: "new-york",
  NC: "north-carolina",
  ND: "north-dakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhode-island",
  SC: "south-carolina",
  SD: "south-dakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "west-virginia",
  WI: "wisconsin",
  WY: "wyoming",
}

type LandSearchSearchParams = {
  state: string
  minPrice?: number
  maxPrice?: number
  minAcres?: number
  maxAcres?: number
}

function buildSearchURL(params: LandSearchSearchParams): string {
  const stateSlug = STATE_NAMES[params.state] ?? params.state.toLowerCase().replace(/\s+/g, "-")
  const baseURL = `https://www.landsearch.com/properties/${stateSlug}`
  
  const filters: string[] = []
  
  if (params.minPrice !== undefined && params.minPrice > 0) {
    filters.push(`price[min]=${params.minPrice}`)
  }
  if (params.maxPrice !== undefined && params.maxPrice > 0) {
    filters.push(`price[max]=${params.maxPrice}`)
  }
  if (params.minAcres !== undefined && params.minAcres > 0) {
    filters.push(`size[min]=${params.minAcres}`)
  }
  if (params.maxAcres !== undefined && params.maxAcres > 0) {
    filters.push(`size[max]=${params.maxAcres}`)
  }
  
  if (filters.length > 0) {
    return `${baseURL}/filter/${filters.join(',')}`
  }
  
  return baseURL
}

function getPriceForState(criteria: SearchCriteria, state: string): { min?: number; max?: number } {
  const regionPrice = criteria.priceRange.byRegion?.[state]
  if (regionPrice) {
    return {
      min: regionPrice.min ?? criteria.priceRange.default.min,
      max: regionPrice.max ?? criteria.priceRange.default.max,
    }
  }
  return criteria.priceRange.default
}

function normalizePropertyData(rawData: {
  source_id: string
  url: string
  title: string
  description?: string
  price?: string
  acres?: string
  state?: string
  county?: string
  city?: string
  address?: string
  images?: string[]
  [key: string]: unknown
}): Property {
  const id = generatePropertyId("landsearch", rawData.source_id)

  const property: Property = {
    id,
    source: "landsearch",
    source_id: rawData.source_id,
    url: rawData.url,
    title: rawData.title,
    rawData,
  }

  if (rawData.description) {
    property.description = rawData.description
  }

  if (rawData.price) {
    const priceMatch = rawData.price.match(/[\d,]+/)
    if (priceMatch) {
      property.price = parseFloat(priceMatch[0].replace(/,/g, ""))
    }
  }

  if (rawData.acres) {
    const acresMatch = rawData.acres.match(/[\d.]+/)
    if (acresMatch) {
      property.acres = parseFloat(acresMatch[0])
    }
  }

  if (rawData.state) property.state = rawData.state
  if (rawData.county) property.county = rawData.county
  if (rawData.city) property.city = rawData.city
  if (rawData.address) property.address = rawData.address
  if (rawData.images && rawData.images.length > 0) property.images = rawData.images

  return property
}

function matchesLocalFilters(property: Property, criteria: SearchCriteria): boolean {
  if (criteria.distanceToTown) {
    if (
      property.distanceToTownMinutes === undefined ||
      property.distanceToTownMinutes < criteria.distanceToTown.min ||
      property.distanceToTownMinutes > criteria.distanceToTown.max
    ) {
      return false
    }
  }

  if (criteria.terrain && criteria.terrain.length > 0) {
    if (!property.terrainTags || property.terrainTags.length === 0) {
      return false
    }
    const hasMatchingTerrain = criteria.terrain.some((t) => property.terrainTags?.includes(t))
    if (!hasMatchingTerrain) {
      return false
    }
  }

  return true
}

async function* search(
  criteria: SearchCriteria,
  options?: { callbacks?: SearchCallbacks; browserPool?: any },
): AsyncGenerator<Property, void, unknown> {
  const callbacks = options?.callbacks
  const browserPool = options?.browserPool
  const rateLimiter = createRateLimiter(2500)
  let page: any = null
  let ownBrowser: any = null

  try {
    // Use shared browser pool if provided, otherwise create own browser
    if (browserPool) {
      callbacks?.onProgress?.("[landsearch] Creating new tab in shared browser")
      page = await browserPool.createPage()
    } else {
      callbacks?.onProgress?.("[landsearch] Launching own browser")
      ownBrowser = await launchBrowser({ headless: false })
      page = ownBrowser.page
    }

    if (!page) {
      throw new Error("[landsearch] Failed to create browser page")
    }

    for (const state of criteria.states) {
      const priceRange = getPriceForState(criteria, state)

      const searchParams: LandSearchSearchParams = {
        state,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minAcres: criteria.minAcres,
        maxAcres: criteria.maxAcres,
      }

      const searchURL = buildSearchURL(searchParams)
      callbacks?.onProgress?.(`[landsearch] Searching ${state}: ${searchURL}`)

      await rateLimiter.wait()

      const navigated = await navigateWithRetry(page, searchURL)
      if (!navigated) {
        callbacks?.onError?.(new Error(`Failed to navigate to ${searchURL}`))
        continue
      }

      const listingSelector = ".preview"
      const hasListings = await waitForSelector(page, listingSelector, 10000)

      if (!hasListings) {
        callbacks?.onProgress?.(`[landsearch] No listings found for ${state}`)
        continue
      }

      let pageNum = 1
      let hasMorePages = true

      while (hasMorePages) {
        callbacks?.onProgress?.(`[landsearch] Processing ${state} page ${pageNum}`)

        const listings = await page.$$(listingSelector)
        callbacks?.onProgress?.(`[landsearch] Found ${listings.length} listings on page ${pageNum}`)

        for (const listing of listings) {
          try {
            const linkEl = await listing.$("a.preview__link")
            const titleEl = await listing.$(".preview__title")
            const sizeEl = await listing.$(".preview__size")
            const locationEl = await listing.$(".preview__location")
            const countyEl = await listing.$(".preview__subterritory")

            if (!linkEl) {
              continue
            }

            const url = (await linkEl.getAttribute("href")) || ""
            
            if (!url) {
              continue
            }

            const fullURL = url.startsWith("http") ? url : `https://www.landsearch.com${url}`

            const sourceIdMatch = url.match(/\/(\d+)$/)
            const sourceId = sourceIdMatch?.[1] ?? url

            const sizeText = (await sizeEl?.textContent())?.trim()
            const location = (await locationEl?.textContent())?.trim()
            const county = (await countyEl?.textContent())?.trim()
            
            let priceText = (await titleEl?.textContent())?.trim() || ""
            if (sizeText && priceText.includes(sizeText)) {
              priceText = priceText.replace(sizeText, '').trim()
            }
            
            const priceMatch = priceText.match(/\$[\d,]+/)
            const price = priceMatch?.[0]
            const title = location || priceText

            const rawData = {
              source_id: sourceId,
              url: fullURL,
              title,
              state,
              price: price ?? undefined,
              acres: sizeText ?? undefined,
              location: location ?? undefined,
              county: county ?? undefined,
            }

            const property = normalizePropertyData(rawData)

            if (matchesLocalFilters(property, criteria)) {
              callbacks?.onPropertyFound?.(property)
              yield property
            }
          } catch (error) {
            logger.debug(`[landsearch] Error processing listing: ${error}`)
          }
        }

        const nextButton = await page.$(
          "a[rel='next'], button.next, [aria-label='Next page'], .pagination a:has-text('Next')",
        )
        if (nextButton) {
          const isDisabled = await nextButton.getAttribute("disabled")
          const ariaDisabled = await nextButton.getAttribute("aria-disabled")
          if (!isDisabled && ariaDisabled !== "true") {
            await rateLimiter.wait()
            await nextButton.click()
            await page.waitForTimeout(randomDelay(1800, 0.4))
            pageNum++
          } else {
            hasMorePages = false
          }
        } else {
          hasMorePages = false
        }
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks?.onError?.(err)
    logger.error(`[landsearch] Search error: ${err.message}`)
  } finally {
    // Only close if we created our own browser
    if (ownBrowser) {
      await closeBrowser(ownBrowser)
    } else if (page && browserPool) {
      // Close just the page (tab) if using shared browser
      await page.close()
    }
  }
}

const landsearchPlugin: PropertySource = {
  metadata,
  search,
}

export default landsearchPlugin
