import { launchBrowser, closeBrowser, navigateWithRetry, waitForSelector } from "../src/utils/playwright-helpers"

async function debugScrape() {
  console.log("Debugging what Zillow plugin actually scrapes...\n")

  const searchURL = `https://www.zillow.com/mt/land/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A35%2C%22regionType%22%3A2%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22sf%22%3A%7B%22value%22%3Afalse%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22lot%22%3A%7B%22min%22%3A435600%2C%22max%22%3A4356000%7D%7D%2C%22isListVisible%22%3Atrue%2C%22usersSearchTerm%22%3A%22MT%22%7D`

  console.log("Opening browser...")
  const session = await launchBrowser({ headless: false, stealth: true })

  try {
    console.log("Navigating to URL...")
    const navigated = await navigateWithRetry(session.page, searchURL)
    if (!navigated) {
      console.log("❌ Failed to navigate")
      return
    }

    console.log("Waiting for listings to appear...")
    const listingSelector = "article[data-test='property-card']"
    const hasListings = await waitForSelector(session.page, listingSelector, 15000)
    
    if (!hasListings) {
      console.log("❌ No listings found")
      return
    }

    console.log("✅ Listings found, waiting additional 5 seconds for JS filtering...")
    await session.page.waitForTimeout(5000)

    console.log("\nScraping listings (same as plugin does)...\n")
    const listings = await session.page.$$(listingSelector)
    console.log(`Found ${listings.length} listings\n`)

    let inRange = 0
    let outOfRange = 0

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      if (!listing) continue

      const linkEl = await listing.$("a[data-test='property-card-link']")
      const addressEl = await listing.$("address")
      const priceEl = await listing.$("span[data-test='property-card-price']")
      const detailsEl = await listing.$("ul[class*='StyledPropertyCardHomeDetailsList']")

      const address = (await addressEl?.textContent())?.trim() || ""
      const priceText = (await priceEl?.textContent())?.trim() || ""
      const detailsText = (await detailsEl?.textContent())?.trim() || ""

      // Parse price
      let price: number | undefined
      const priceMatch = priceText.match(/[\d,]+/)
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/,/g, ""))
      }

      // Parse acres
      let acres: number | undefined
      const acresMatch = detailsText.match(/([\d,.]+)\s*(acres?|ac)/i)
      if (acresMatch?.[1]) {
        acres = parseFloat(acresMatch[1].replace(/,/g, ""))
      } else {
        const sqftMatch = detailsText.match(/([\d,]+)\s*sq\s*ft/i)
        if (sqftMatch?.[1]) {
          const sqft = parseFloat(sqftMatch[1].replace(/,/g, ""))
          acres = sqft / 43560
        }
      }

      const priceOk = !price || (price >= 50000 && price <= 500000)
      const acresOk = !acres || (acres >= 10 && acres <= 100)
      const status = (priceOk && acresOk) ? "✅" : "❌"
      
      if (priceOk && acresOk) {
        inRange++
      } else {
        outOfRange++
      }

      console.log(`${status} [${i + 1}] ${address}`)
      console.log(`   Price: ${price ? '$' + price.toLocaleString() : 'N/A'} ${priceOk ? '' : '(OUT OF RANGE)'}`)
      console.log(`   Acres: ${acres?.toFixed(2) ?? 'N/A'} ${acresOk ? '' : '(OUT OF RANGE)'}`)
      console.log(`   Details: ${detailsText.substring(0, 60)}`)
      console.log("")
    }

    console.log("=".repeat(70))
    console.log(`SUMMARY: ${inRange} in range, ${outOfRange} out of range`)
    console.log("=".repeat(70))

    console.log("\nBrowser will stay open for 30 seconds so you can inspect...")
    await session.page.waitForTimeout(30000)

  } finally {
    await closeBrowser(session)
  }
}

debugScrape().catch(console.error)
