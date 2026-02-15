import { chromium } from "playwright"

async function inspectLandsOfAmerica() {
  console.log("Inspecting Lands of America page structure...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  const url = "https://www.landsofamerica.com/MT/all-land/?MinPrice=50000&MaxPrice=500000&MinAcreage=10&MaxAcreage=100"

  console.log(`Navigating to: ${url}\n`)
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })

  await page.waitForTimeout(5000)

  console.log(`Final URL: ${page.url()}\n`)

  const selectors = [
    ".proplist-table tr",
    ".property-listing",
    ".listing-item",
    "[data-testid='property-listing']",
    ".property-card",
    "[class*='property']",
    "[class*='listing']",
    "article",
    ".result",
    "[data-qa-listing]",
  ]

  for (const selector of selectors) {
    const count = await page.$$eval(selector, (els) => els.length).catch(() => 0)
    if (count > 0) {
      console.log(`✅ Found ${count} elements: ${selector}`)
    } else {
      console.log(`❌ No elements: ${selector}`)
    }
  }

  console.log("\nTaking screenshot...")
  await page.screenshot({ path: "data/landsofamerica-page.png", fullPage: true })
  console.log("✅ Screenshot saved to data/landsofamerica-page.png")

  console.log("\nGetting page title...")
  const title = await page.title()
  console.log(`Page title: ${title}`)

  await browser.close()
}

inspectLandsOfAmerica().catch(console.error)
