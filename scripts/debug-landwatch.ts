import { chromium } from "playwright"

async function debugLandWatch() {
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })
  const page = await context.newPage()

  const url = "https://www.landwatch.com/mt-land-for-sale?maxPrice=1200000&minAcres=20"
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })
  console.log("Page loaded")

  console.log("\n--- Page Title ---")
  console.log(await page.title())

  console.log("\n--- Looking for common listing selectors ---")

  const selectors = [
    ".listing-card",
    ".property-card",
    "[data-testid='listing-card']",
    ".listings",
    ".listing",
    ".property",
    ".results",
    ".search-results",
    "article",
    "[class*='listing']",
    "[class*='property']",
    "[class*='card']",
    "a[href*='/land/']",
    "a[href*='/property/']",
  ]

  for (const selector of selectors) {
    const count = await page.locator(selector).count()
    if (count > 0) {
      console.log(`  ✅ ${selector}: ${count} elements`)
    }
  }

  console.log("\n--- First 5 links containing 'land' or 'property' ---")
  const links = await page.$$eval("a", (anchors) =>
    anchors
      .filter((a) => a.href && (a.href.includes("/land/") || a.href.includes("/property/")))
      .slice(0, 5)
      .map((a) => ({ href: a.href, text: a.textContent?.trim().slice(0, 50) })),
  )
  for (const link of links) {
    console.log(`  - ${link.text}: ${link.href}`)
  }

  console.log("\n--- Looking at page structure ---")
  const bodyClasses = await page.$eval("body", (el) => el.className)
  console.log(`Body classes: ${bodyClasses}`)

  const mainContent = await page.$("main, #main, .main, [role='main']")
  if (mainContent) {
    const mainClasses = await mainContent.evaluate((el) => el.className)
    console.log(`Main content classes: ${mainClasses}`)
  }

  console.log("\n--- Taking screenshot ---")
  await page.screenshot({ path: "data/debug-landwatch.png", fullPage: false })
  console.log("Screenshot saved to data/debug-landwatch.png")

  console.log("\n--- Saving HTML snippet ---")
  const html = await page.content()
  const fs = await import("fs")
  fs.writeFileSync("data/debug-landwatch.html", html)
  console.log("HTML saved to data/debug-landwatch.html")

  await browser.close()
  console.log("\nDone!")
}

debugLandWatch().catch(console.error)
