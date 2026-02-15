import type { PropertySource, PluginMetadata, SearchCallbacks } from "../types"
import type { SearchCriteria } from "../../models/search-criteria"
import type { Property } from "../../models/property"
import type { Page } from "playwright"
import { generatePropertyId } from "../../utils/hash"
import { createRateLimiter, randomDelay } from "../../utils/rate-limiter"
import {
  launchBrowser,
  closeBrowser,
  navigateWithRetry,
  waitForSelector,
} from "../../utils/playwright-helpers"
import { logger } from "../../utils/logger"

// Zillow uses regionId for each state (regionType: 2 = state)
const STATE_REGION_IDS: Record<string, number> = {
  AL: 4, AK: 3, AZ: 7, AR: 6, CA: 9, CO: 10, CT: 11, DE: 13, FL: 14, GA: 16,
  HI: 17, ID: 18, IL: 19, IN: 20, IA: 21, KS: 22, KY: 23, LA: 24, ME: 26,
  MD: 27, MA: 28, MI: 29, MN: 30, MS: 31, MO: 32, MT: 35, NE: 36, NV: 37,
  NH: 38, NJ: 39, NM: 40, NY: 41, NC: 42, ND: 43, OH: 44, OK: 45, OR: 46,
  PA: 47, RI: 49, SC: 50, SD: 51, TN: 52, TX: 53, UT: 54, VT: 55, VA: 56,
  WA: 57, WV: 58, WI: 59, WY: 60,
}

const STATE_SLUGS: Record<string, string> = {
  AL: "al", AK: "ak", AZ: "az", AR: "ar", CA: "ca", CO: "co", CT: "ct", DE: "de",
  FL: "fl", GA: "ga", HI: "hi", ID: "id", IL: "il", IN: "in", IA: "ia", KS: "ks",
  KY: "ky", LA: "la", ME: "me", MD: "md", MA: "ma", MI: "mi", MN: "mn", MS: "ms",
  MO: "mo", MT: "mt", NE: "ne", NV: "nv", NH: "nh", NJ: "nj", NM: "nm", NY: "ny",
  NC: "nc", ND: "nd", OH: "oh", OK: "ok", OR: "or", PA: "pa", RI: "ri", SC: "sc",
  SD: "sd", TN: "tn", TX: "tx", UT: "ut", VT: "vt", VA: "va", WA: "wa", WV: "wv",
  WI: "wi", WY: "wy",
}

const metadata: PluginMetadata = {
  name: "zillow",
  displayName: "Zillow",
  version: "1.0.0",
  description: "Scrapes property listings from Zillow.com",
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

type ZillowSearchParams = {
  state: string
  minPrice?: number
  maxPrice?: number
  minLotSize?: number
  maxLotSize?: number
}

function buildSearchURL(params: ZillowSearchParams): string {
  const stateSlug = STATE_SLUGS[params.state.toUpperCase()] || params.state.toLowerCase()
  const baseURL = `https://www.zillow.com/${stateSlug}/land/`

  // Build the searchQueryState JSON object
  // Note: We omit regionSelection because the URL slug is sufficient
  // Using regionId caused incorrect state mappings (e.g., WY showing Wisconsin)
  type FilterState = {
    sort: { value: string }
    sf: { value: boolean }
    tow: { value: boolean }
    mf: { value: boolean }
    con: { value: boolean }
    apa: { value: boolean }
    manu: { value: boolean }
    apco: { value: boolean }
    price?: { min?: number; max?: number }
    lot?: { min?: number; max?: number }
  }

  const filterState: FilterState = {
    sort: { value: "globalrelevanceex" },
    sf: { value: false },    // single family
    tow: { value: false },   // townhouse
    mf: { value: false },    // multi-family
    con: { value: false },   // condo
    apa: { value: false },   // apartment
    manu: { value: false },  // manufactured
    apco: { value: false },  // apartment/condo
  }

  // Add price filter
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    filterState.price = {}
    if (params.minPrice !== undefined) {
      filterState.price.min = params.minPrice
    }
    if (params.maxPrice !== undefined) {
      filterState.price.max = params.maxPrice
    }
  }

  // Add lot size filter (convert acres to sqft)
  if (params.minLotSize !== undefined || params.maxLotSize !== undefined) {
    filterState.lot = {}
    if (params.minLotSize !== undefined) {
      filterState.lot.min = Math.round(params.minLotSize * 43560)
    }
    if (params.maxLotSize !== undefined) {
      filterState.lot.max = Math.round(params.maxLotSize * 43560)
    }
  }

  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    filterState,
    isListVisible: true,
  }

  return `${baseURL}?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`
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
  lotSize?: string
  state?: string
  county?: string
  city?: string
  address?: string
  images?: string[]
  [key: string]: unknown
}): Property {
  const id = generatePropertyId("zillow", rawData.source_id)

  const property: Property = {
    id,
    source: "zillow",
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

  if (rawData.lotSize) {
    const acresMatch = rawData.lotSize.match(/([\d,.]+)\s*(acres?|ac)/i)
    if (acresMatch?.[1]) {
      property.acres = parseFloat(acresMatch[1].replace(/,/g, ""))
    } else {
      const sqftMatch = rawData.lotSize.match(/([\d,]+)\s*sq\s*ft/i)
      if (sqftMatch?.[1]) {
        const sqft = parseFloat(sqftMatch[1].replace(/,/g, ""))
        property.acres = sqft / 43560
      }
    }
  }

  if (rawData.state) property.state = rawData.state
  if (rawData.county) property.county = rawData.county
  if (rawData.city) property.city = rawData.city
  if (rawData.address) property.address = rawData.address
  if (rawData.images && rawData.images.length > 0) property.images = rawData.images

  return property
}

async function scrollToLoadAllListings(
  page: Page,
  listingSelector: string,
  callbacks?: SearchCallbacks,
): Promise<void> {
  let scrollAttempts = 0
  const maxScrollAttempts = 50
  let noNewListingsCount = 0
  const maxNoNewListings = 3 // Stop after 3 scrolls with no new content

  let lastCount = (await page.$$(listingSelector)).length

  while (scrollAttempts < maxScrollAttempts && noNewListingsCount < maxNoNewListings) {
    // Scroll down by large random amount (800-1500px)
    const scrollAmount = 800 + Math.random() * 700
    await page.evaluate((amount: number) => {
      ;(globalThis as any).scrollBy(0, amount)
    }, scrollAmount)

    // Short random delay (0.5-1.5s for speed)
    await page.waitForTimeout(randomDelay(1000, 0.5))

    // Check if listings increased
    const currentCount = (await page.$$(listingSelector)).length
    if (currentCount > lastCount) {
      callbacks?.onProgress?.(
        `[zillow] Loaded ${currentCount - lastCount} more listings (${currentCount} total)`,
      )
      lastCount = currentCount
      noNewListingsCount = 0 // Reset counter
    } else {
      noNewListingsCount++
    }

    scrollAttempts++
  }

  callbacks?.onProgress?.(
    `[zillow] Finished scrolling - ${lastCount} listings loaded after ${scrollAttempts} scrolls`,
  )

  // Final scroll to absolute bottom to ensure pagination is fully visible
  await page.evaluate(() => {
    const doc = globalThis as any
    doc.scrollTo(0, doc.document.documentElement.scrollHeight)
  })
  await page.waitForTimeout(500)
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
  callbacks?: SearchCallbacks,
): AsyncGenerator<Property, void, unknown> {
  const rateLimiter = createRateLimiter(3000)
  let session

  try {
    callbacks?.onProgress?.("[zillow] Launching browser with stealth mode")
    session = await launchBrowser({ headless: false, stealth: true })

    for (const state of criteria.states) {
      const priceRange = getPriceForState(criteria, state)

      const searchParams: ZillowSearchParams = {
        state,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minLotSize: criteria.minAcres,
        maxLotSize: criteria.maxAcres,
      }

      const searchURL = buildSearchURL(searchParams)
      callbacks?.onProgress?.(`[zillow] Searching ${state}: ${searchURL}`)

      await rateLimiter.wait()

      const navigated = await navigateWithRetry(session.page, searchURL)
      if (!navigated) {
        callbacks?.onError?.(new Error(`Failed to navigate to ${searchURL}`))
        continue
      }

      const listingSelector =
        "article[data-test='property-card'], .list-card, [data-testid='property-card']"
      const hasListings = await waitForSelector(session.page, listingSelector, 15000)

      if (!hasListings) {
        callbacks?.onProgress?.(`[zillow] No listings found for ${state}`)
        continue
      }

      let pageNum = 1
      let hasMorePages = true

      while (hasMorePages) {
        callbacks?.onProgress?.(`[zillow] Processing ${state} page ${pageNum}`)

        // Scroll to load all listings on this page
        await scrollToLoadAllListings(session.page, listingSelector, callbacks)

        const listings = await session.page.$$(listingSelector)
        callbacks?.onProgress?.(`[zillow] Found ${listings.length} listings on page ${pageNum}`)

        for (const listing of listings) {
          try {
            const linkEl = await listing.$("a[data-test='property-card-link']")
            const addressEl = await listing.$("address")
            const priceEl = await listing.$("span[data-test='property-card-price']")
            const detailsEl = await listing.$("ul[class*='StyledPropertyCardHomeDetailsList']")

            if (!linkEl) {
              continue
            }

            const url = (await linkEl.getAttribute("href")) || ""
            const address = (await addressEl?.textContent())?.trim() || ""
            const price = (await priceEl?.textContent())?.trim()
            const detailsText = (await detailsEl?.textContent())?.trim()

            if (!url || !address) {
              continue
            }

            const fullURL = url.startsWith("http") ? url : `https://www.zillow.com${url}`

            const sourceIdMatch =
              url.match(/\/homedetails\/[^/]+\/(\d+)_zpid/) ||
              url.match(/zpid[=\/](\d+)/) ||
              url.match(/\/(\d+)_zpid/)
            const sourceId = sourceIdMatch?.[1] ?? url

            let lotSize: string | undefined

            if (detailsText) {
              const lotMatch =
                detailsText.match(/([\d,.]+)\s*acres?/i) ||
                detailsText.match(/([\d,]+)\s*sq\s*ft\s*lot/i)
              if (lotMatch) {
                lotSize = lotMatch[0]
              }
            }

            const title = address

            const rawData = {
              source_id: sourceId,
              url: fullURL,
              title,
              address,
              state,
              price: price ?? undefined,
              lotSize: lotSize ?? undefined,
            }

            const property = normalizePropertyData(rawData)

            if (matchesLocalFilters(property, criteria)) {
              callbacks?.onPropertyFound?.(property)
              yield property
            }
          } catch (error) {
            logger.debug(`[zillow] Error processing listing: ${error}`)
          }
        }

        const nextButton = await session.page.$(
          "a[rel='next'], a[aria-label='Next page'], .pagination-next",
        )
        if (nextButton) {
          const isDisabled =
            (await nextButton.getAttribute("aria-disabled")) === "true" ||
            (await nextButton.getAttribute("disabled")) !== null
          if (!isDisabled) {
            await nextButton.click()
            await session.page.waitForTimeout(randomDelay(2000, 0.4))
            // Wait for listings to reload
            await waitForSelector(session.page, listingSelector, 10000)
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
    logger.error(`[zillow] Search error: ${err.message}`)
  } finally {
    if (session) {
      await closeBrowser(session)
    }
  }
}

const zillowPlugin: PropertySource = {
  metadata,
  search,
}

export default zillowPlugin
