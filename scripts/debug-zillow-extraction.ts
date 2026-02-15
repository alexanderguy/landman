import { launchBrowser, closeBrowser, navigateWithRetry } from "../src/utils/playwright-helpers"

async function debugExtraction() {
  console.log("Debugging Zillow data extraction...\n")

  const searchURL = `https://www.zillow.com/mt/land/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A35%2C%22regionType%22%3A2%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22sf%22%3A%7B%22value%22%3Afalse%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22lot%22%3A%7B%22min%22%3A435600%2C%22max%22%3A4356000%7D%7D%2C%22isListVisible%22%3Atrue%7D`

  const session = await launchBrowser({ headless: false, stealth: true })

  try {
    await navigateWithRetry(session.page, searchURL)
    await session.page.waitForTimeout(5000)

    const listingSelector = "article[data-test='property-card']"
    const listings = await session.page.$$(listingSelector)
    
    console.log(`Found ${listings.length} listings\n`)

    for (let i = 0; i < Math.min(3, listings.length); i++) {
      const listing = listings[i]
      if (!listing) continue

      console.log(`\n=== Listing ${i + 1} ===`)

      // Extract with updated selectors
      const linkEl = await listing.$("a[data-test='property-card-link']")
      const addressEl = await listing.$("address")
      const priceEl = await listing.$("span[data-test='property-card-price']")
      const detailsEl = await listing.$("ul[class*='StyledPropertyCardHomeDetailsList']")

      const url = (await linkEl?.getAttribute("href")) || ""
      const address = (await addressEl?.textContent())?.trim() || ""
      const price = (await priceEl?.textContent())?.trim() || ""
      const detailsText = (await detailsEl?.textContent())?.trim() || ""

      console.log(`URL: ${url}`)
      console.log(`Address: ${address}`)
      console.log(`Price: ${price}`)
      console.log(`Details: ${detailsText}`)

      // Try to find all text content
      const allText = (await listing.textContent())?.trim() || ""
      console.log(`\nAll text content:`)
      console.log(allText.substring(0, 400))
    }

    console.log("\n\nPress Ctrl+C to exit...")
    await session.page.waitForTimeout(60000)

  } finally {
    await closeBrowser(session)
  }
}

debugExtraction().catch(console.error)
