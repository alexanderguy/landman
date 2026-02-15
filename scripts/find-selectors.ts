import { chromium } from "playwright"

async function findSelectors() {
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })
  const page = await context.newPage()

  const url = "https://www.landwatch.com/mt-land-for-sale?maxPrice=1200000&minAcres=20"
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })
  console.log("Page loaded")

  console.log("\nWaiting 5 seconds for any dynamic content...")
  await page.waitForTimeout(5000)

  console.log("\nTesting selectors:")

  const testSelectors = [
    ".listing-card",
    ".property-card", 
    "[data-testid='listing-card']",
    ".result-list-item",
    ".search-result-item",
    "div[id*='listing']",
    "div[class*='listing']",
    "div[class*='result']",
    "div[class*='property']",
    "a[href*='/land-for-sale/']",
    "article",
  ]

  for (const selector of testSelectors) {
    const count = await page.locator(selector).count()
    if (count > 0) {
      console.log(`  ✅ "${selector}" = ${count} matches`)
      
      // Get first element's outer HTML
      const first = page.locator(selector).first()
      const html = await first.evaluate(el => el.outerHTML.substring(0, 200))
      console.log(`     Sample: ${html}...`)
    }
  }

  console.log("\n\nLooking for ANY elements with common property listing patterns:")
  
  const allDivs = await page.$$("div")
  console.log(`Total divs on page: ${allDivs.length}`)

  // Look for elements containing price-like text
  const priceElements = await page.$$eval("*", elements => 
    elements
      .filter(el => {
        const text = el.textContent || ""
        return /\$[\d,]+/.test(text) && text.length < 100
      })
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        text: (el.textContent || "").substring(0, 50)
      }))
  )
  
  if (priceElements.length > 0) {
    console.log("\nElements with price-like text:")
    for (const el of priceElements) {
      console.log(`  - <${el.tag}${el.class ? ` class="${el.class}"` : ""}> ${el.text}`)
    }
  }

  console.log("\n\nInspect the browser window - what do you see?")
  console.log("Press Ctrl+C when done inspecting...")
  
  await page.waitForTimeout(300000) // 5 minutes to inspect

  await browser.close()
}

findSelectors().catch(console.error)
