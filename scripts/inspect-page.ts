import { chromium } from "playwright"

async function inspectPage() {
  const browser = await chromium.launch({ headless: false })
  const page = await (await browser.newContext()).newPage()

  console.log("Opening LandWatch Montana search...")
  await page.goto("https://www.landwatch.com/mt-land-for-sale?maxPrice=1200000&minAcres=20", {
    waitUntil: "networkidle",
  })

  console.log("\n✅ Page loaded!")
  console.log("\n📋 Testing selectors in 3 seconds...")
  await page.waitForTimeout(3000)

  const results = []

  // Test all possible selectors
  const selectors = [
    'a[href*="land-for-sale"]',
    '.listing-item',
    '.property-item', 
    '.search-result',
    'div[class*="Land"]',
    'div[class*="Property"]',
    'div[class*="Result"]',
    'div[class*="Card"]',
    'article',
  ]

  for (const sel of selectors) {
    const count = await page.locator(sel).count()
    if (count > 0) {
      results.push({ selector: sel, count })
      
      const firstEl = page.locator(sel).first()
      const classes = await firstEl.getAttribute("class")
      results.push({ selector: `  └─ classes:`, count: classes || "none" })
    }
  }

  console.log("\n📊 Matching selectors:")
  for (const r of results) {
    console.log(`${r.selector}: ${r.count}`)
  }

  // Try to extract any visible property data
  console.log("\n🔍 Looking for property-like content...")
  const propertyData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="land-for-sale"]'))
    return links.slice(0, 3).map(link => ({
      href: (link as HTMLAnchorElement).href,
      text: link.textContent?.trim().substring(0, 60),
      parent: link.parentElement?.className,
    }))
  })

  if (propertyData.length > 0) {
    console.log("\n📍 Sample property links found:")
    for (const prop of propertyData) {
      console.log(`  - ${prop.text}`)
      console.log(`    ${prop.href}`)
      console.log(`    Parent class: ${prop.parent}`)
    }
  } else {
    console.log("  ❌ No property links found")
  }

  console.log("\n\n👀 Check the browser window - do you see property listings?")
  console.log("Browser will stay open for 60 seconds...")
  
  await page.waitForTimeout(60000)
  await browser.close()
  console.log("\n✅ Done!")
}

inspectPage().catch(console.error)
