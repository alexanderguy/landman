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

const STATE_SLUGS: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri",
  MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire", NJ: "new-jersey",
  NM: "new-mexico", NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
}

const metadata: PluginMetadata = {
  name: "landwatch",
  displayName: "LandWatch",
  version: "1.0.0",
  description: "Scrapes property listings from LandWatch.com with server-side price and acreage filtering via direct URL construction.",
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

type LandWatchSearchParams = {
  state: string
  minPrice?: number
  maxPrice?: number
  minAcres?: number
  maxAcres?: number
}

function buildSearchURL(params: LandWatchSearchParams): string {
  const stateSlug = STATE_SLUGS[params.state.toUpperCase()] || params.state.toLowerCase()
  const parts: string[] = [`${stateSlug}-land-for-sale`]

  // Add price filter if either min or max is defined
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const min = params.minPrice ?? 0
    const max = params.maxPrice ?? 99999999
    parts.push(`price-${min}-${max}`)
  }

  // Add acreage filter if either min or max is defined
  if (params.minAcres !== undefined || params.maxAcres !== undefined) {
    const min = params.minAcres ?? 0
    const max = params.maxAcres ?? 99999
    parts.push(`acres-${min}-${max}`)
  }

  return `https://www.landwatch.com/${parts.join("/")}`
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
  const id = generatePropertyId("landwatch", rawData.source_id)

  const property: Property = {
    id,
    source: "landwatch",
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
      callbacks?.onProgress?.("[landwatch] Creating new tab in shared browser")
      page = await browserPool.createPage()
    } else {
      callbacks?.onProgress?.("[landwatch] Launching own browser")
      ownBrowser = await launchBrowser({ headless: false })
      page = ownBrowser.page
    }

    if (!page) {
      throw new Error("[landwatch] Failed to create browser page")
    }

    for (const state of criteria.states) {
      const priceRange = getPriceForState(criteria, state)
      const searchURL = buildSearchURL({
        state,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minAcres: criteria.minAcres,
        maxAcres: criteria.maxAcres,
      })

      callbacks?.onProgress?.(`[landwatch] Searching ${state}: ${searchURL}`)

      await rateLimiter.wait()

      const navigated = await navigateWithRetry(page, searchURL)
      if (!navigated) {
        callbacks?.onError?.(new Error(`Failed to navigate to ${searchURL}`))
        continue
      }

      const listingSelector = "[data-qa-listing]"
      const hasListings = await waitForSelector(page, listingSelector, 10000)

      if (!hasListings) {
        callbacks?.onProgress?.(`[landwatch] No listings found for ${state}`)
        continue
      }

      let pageNum = 1
      let hasMorePages = true

      while (hasMorePages) {
        callbacks?.onProgress?.(`[landwatch] Processing ${state} page ${pageNum}`)

        const listings = await page.$$(listingSelector)
        callbacks?.onProgress?.(`[landwatch] Found ${listings.length} listings on page ${pageNum}`)

        for (const listing of listings) {
          try {
            const titleLink = await listing.$("a[href*='/pid/']")
            
            if (!titleLink) {
              continue
            }

            const title = (await titleLink.textContent())?.trim() || ""
            const url = (await titleLink.getAttribute("href")) || ""

            if (!url) {
              continue
            }

            const fullURL = url.startsWith("http") ? url : `https://www.landwatch.com${url}`

            const sourceIdMatch = url.match(/\/pid\/(\d+)/)
            const sourceId = sourceIdMatch?.[1] ?? url

            const allText = (await listing.textContent()) || ""

            const priceMatch = allText.match(/\$[\d,]+/)
            const price = priceMatch ? priceMatch[0] : undefined

            const acresMatch = allText.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
            const acres = acresMatch ? acresMatch[1] : undefined

            const locationMatch = allText.match(/([A-Za-z\s]+),\s*([A-Z]{2}),?\s*(\d{5})?/)
            const city = locationMatch?.[1]?.trim()

            const countyMatch = allText.match(/([A-Za-z\s]+)\s+County/i)
            const county = countyMatch?.[1]?.trim()

            const descEl = await listing.$("[data-qa-placard-description]")
            const description = (await descEl?.textContent())?.trim()

            const rawData = {
              source_id: sourceId,
              url: fullURL,
              title,
              state,
              price: price ?? undefined,
              acres: acres ?? undefined,
              city: city ?? undefined,
              county: county ?? undefined,
              description: description ?? undefined,
            }

            const property = normalizePropertyData(rawData)

            if (matchesLocalFilters(property, criteria)) {
              callbacks?.onPropertyFound?.(property)
              yield property
            }
          } catch (error) {
            logger.debug(`[landwatch] Error processing listing: ${error}`)
          }
        }

        const nextButton = await page.$("[data-testid='next']")
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
    logger.error(`[landwatch] Search error: ${err.message}`)
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

const landwatchPlugin: PropertySource = {
  metadata,
  search,
}

export default landwatchPlugin
