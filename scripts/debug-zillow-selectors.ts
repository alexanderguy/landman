import { launchBrowser, closeBrowser, navigateWithRetry } from "../src/utils/playwright-helpers"

async function debugZillow() {
  console.log("Debugging Zillow selectors...\n")

  const searchURL = `https://www.zillow.com/mt/land/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A35%2C%22regionType%22%3A2%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22sf%22%3A%7B%22value%22%3Afalse%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22lot%22%3A%7B%22min%22%3A435600%2C%22max%22%3A4356000%7D%7D%2C%22isListVisible%22%3Atrue%7D`

  const session = await launchBrowser({ headless: false, stealth: true })

  try {
    await navigateWithRetry(session.page, searchURL)
    await session.page.waitForTimeout(5000)

    // Try different listing selectors
    const selectors = [
      "article[data-test='property-card']",
      ".list-card",
      "[data-testid='property-card']",
      "article",
      ".search-result",
      "[role='article']",
    ]

    for (const selector of selectors) {
      const count = await session.page.$$(selector)
      console.log(`${selector}: ${count.length} elements`)
    }

    // Get first listing and inspect its structure
    const listingSelector = "article[data-test='property-card'], .list-card, [data-testid='property-card']"
    const listings = await session.page.$$(listingSelector)
    
    if (listings.length > 0 && listings[0]) {
      console.log(`\nFirst listing structure:`)
      const html = await listings[0]?.innerHTML()
      console.log(html.substring(0, 1000))

      // Try to extract data with different selectors
      const linkSelectors = [
        "a[data-test='property-card-link']",
        "a.list-card-link",
        ".property-card-link",
        "a[href*='/homedetails/']",
        "a[href*='zpid']",
        "a",
      ]

      console.log(`\nLink selectors:`)
      for (const linkSel of linkSelectors) {
        const link = await listings[0]?.$(linkSel)
        if (link) {
          const href = await link.getAttribute("href")
          console.log(`  ${linkSel}: ${href?.substring(0, 80)}`)
        }
      }
    }

    console.log("\nPress Ctrl+C to exit (inspecting page for 60 seconds)...")
    await session.page.waitForTimeout(60000)

  } finally {
    await closeBrowser(session)
  }
}

debugZillow().catch(console.error)
