import { chromium } from "playwright"

async function debugLandsOfAmerica() {
  console.log("Debugging Lands of America property extraction...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  const url = "https://www.land.com/Montana/all-land/50000-500000/10-100-acres/"

  console.log(`Navigating to: ${url}\n`)
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })

  await page.waitForSelector("[data-qa-listing]", { timeout: 10000 })
  await page.waitForTimeout(3000)

  const listings = await page.$$("[data-qa-listing]")
  console.log(`Found ${listings.length} listings\n`)

  if (listings.length > 0) {
    const firstListing = listings[0]
    if (!firstListing) return
    
    console.log("Testing different selectors on first listing:\n")
    
    const titleLink1 = await firstListing.$("a[href*='/pid/']")
    console.log(`  a[href*='/pid/']: ${titleLink1 ? "FOUND" : "NOT FOUND"}`)
    
    const titleLink2 = await firstListing.$("a[href*='/property/']")
    console.log(`  a[href*='/property/']: ${titleLink2 ? "FOUND" : "NOT FOUND"}`)
    
    const allLinks = await firstListing.$$("a")
    console.log(`  Total links in listing: ${allLinks.length}`)
    
    if (allLinks.length > 0) {
      for (let i = 0; i < Math.min(allLinks.length, 3); i++) {
        const link = allLinks[i]
        if (!link) continue
        const href = await link.getAttribute("href")
        const text = await link.textContent()
        console.log(`    Link ${i}: ${text?.substring(0, 30)} -> ${href?.substring(0, 50)}`)
      }
    }
    
    console.log("\nFull text content of first listing:")
    const text = await firstListing.textContent()
    console.log(text?.substring(0, 500))
  }

  await browser.close()
}

debugLandsOfAmerica().catch(console.error)
