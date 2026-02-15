import { launchBrowser, closeBrowser } from "../src/utils/playwright-helpers"

// Test what region IDs Zillow actually uses for each state
async function discoverRegionIds() {
  const states = [
    { code: "ID", name: "Idaho" },
    { code: "MT", name: "Montana" },
    { code: "WY", name: "Wyoming" },
    { code: "SD", name: "South Dakota" },
    { code: "WA", name: "Washington" },
  ]
  
  console.log("Launching browser...")
  const session = await launchBrowser({ headless: false, stealth: true })

  try {
    for (const state of states) {
      console.log(`\n=== Testing ${state.name} (${state.code}) ===`)
      
      // Navigate to the simple URL without regionId parameter
      const simpleURL = `https://www.zillow.com/${state.code.toLowerCase()}/land/`
      console.log(`Navigating to: ${simpleURL}`)
      
      await session.page.goto(simpleURL, { waitUntil: "domcontentloaded" })
      await session.page.waitForTimeout(3000)
      
      // Get the final URL after Zillow processes it
      const finalURL = session.page.url()
      console.log(`Final URL: ${finalURL}`)
      
      // Extract searchQueryState from URL
      const urlParams = new URL(finalURL)
      const searchQueryStateParam = urlParams.searchParams.get("searchQueryState")
      
      if (searchQueryStateParam) {
        try {
          const searchQueryState = JSON.parse(decodeURIComponent(searchQueryStateParam))
          
          if (searchQueryState.regionSelection && searchQueryState.regionSelection.length > 0) {
            const region = searchQueryState.regionSelection[0]
            console.log(`✓ Found regionId: ${region.regionId} (regionType: ${region.regionType})`)
          } else {
            console.log("✗ No regionSelection found in searchQueryState")
          }
        } catch (e) {
          console.log(`✗ Failed to parse searchQueryState: ${e}`)
        }
      } else {
        console.log("✗ No searchQueryState parameter in URL")
      }
      
      // Also check the page title to confirm we're on the right state
      const title = await session.page.title()
      console.log(`Page title: ${title}`)
      
      if (title.includes(state.name)) {
        console.log(`✓ Title confirms correct state`)
      } else {
        console.log(`✗ WARNING: Title doesn't match expected state "${state.name}"`)
      }
      
      await session.page.waitForTimeout(2000)
    }
    
    console.log("\n=== Discovery complete ===")
    console.log("Waiting 10 seconds before closing...")
    await session.page.waitForTimeout(10000)
    
  } finally {
    await closeBrowser(session)
  }
}

discoverRegionIds().catch(console.error)
