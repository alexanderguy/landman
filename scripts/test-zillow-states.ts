import { launchBrowser, closeBrowser, navigateWithRetry } from "../src/utils/playwright-helpers"

const STATE_REGION_IDS: Record<string, number> = {
  ID: 18, MT: 35, WY: 60, SD: 51, WA: 57,
}

const STATE_SLUGS: Record<string, string> = {
  ID: "id", MT: "mt", WY: "wy", SD: "sd", WA: "wa",
}

function buildSearchURL(state: string): string {
  const stateSlug = STATE_SLUGS[state]
  const regionId = STATE_REGION_IDS[state]
  const baseURL = `https://www.zillow.com/${stateSlug}/land/`

  const filterState = {
    sort: { value: "globalrelevanceex" },
    sf: { value: false },
    tow: { value: false },
    mf: { value: false },
    con: { value: false },
    apa: { value: false },
    manu: { value: false },
    apco: { value: false },
    price: { min: 100000, max: 1000000 },
    lot: { min: Math.round(20 * 43560), max: Math.round(640 * 43560) },
  }

  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    filterState,
    isListVisible: true,
  }

  return `${baseURL}?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`
}

async function testZillowStates() {
  const states = ["ID", "MT", "WY", "SD", "WA"]
  
  console.log("Launching browser...")
  const session = await launchBrowser({ headless: false, stealth: true })

  try {
    for (const state of states) {
      const url = buildSearchURL(state)
      console.log(`\n=== Testing ${state} ===`)
      console.log(`URL: ${url}`)
      
      const success = await navigateWithRetry(session.page, url)
      
      if (success) {
        console.log(`✓ Successfully navigated to ${state}`)
        
        // Wait a moment to see the page
        await session.page.waitForTimeout(3000)
        
        // Check the actual URL and title
        const actualURL = session.page.url()
        const title = await session.page.title()
        
        console.log(`  Actual URL: ${actualURL}`)
        console.log(`  Page title: ${title}`)
        
        // Check if it actually shows the right state
        const slug = STATE_SLUGS[state]
        if (slug && actualURL.toLowerCase().includes(slug)) {
          console.log(`  ✓ URL contains correct state slug`)
        } else {
          console.log(`  ✗ WARNING: URL doesn't contain state slug "${slug}"`)
        }
      } else {
        console.log(`✗ Failed to navigate to ${state}`)
      }
      
      // Wait before next state
      await session.page.waitForTimeout(2000)
    }
    
    console.log("\n=== Test complete ===")
    console.log("Browser will remain open for 30 seconds for inspection...")
    await session.page.waitForTimeout(30000)
    
  } finally {
    await closeBrowser(session)
  }
}

testZillowStates().catch(console.error)
