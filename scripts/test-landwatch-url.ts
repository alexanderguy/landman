// Quick test to verify LandWatch URL building
const STATE_SLUGS: Record<string, string> = {
  MT: "montana",
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

// Test case 1: Only max price and min acres (Montana profile)
const url1 = buildSearchURL({
  state: "MT",
  maxPrice: 1200000,
  minAcres: 20,
})
console.log("Montana profile URL:", url1)
console.log("Expected: https://www.landwatch.com/montana-land-for-sale/price-0-1200000/acres-20-99999")

// Test case 2: Full range (default profile)
const url2 = buildSearchURL({
  state: "MT",
  minPrice: 100000,
  maxPrice: 1200000,
  minAcres: 20,
  maxAcres: 640,
})
console.log("\nDefault profile URL:", url2)
console.log("Expected: https://www.landwatch.com/montana-land-for-sale/price-100000-1200000/acres-20-640")

// Test case 3: No filters
const url3 = buildSearchURL({
  state: "MT",
})
console.log("\nNo filters URL:", url3)
console.log("Expected: https://www.landwatch.com/montana-land-for-sale")
