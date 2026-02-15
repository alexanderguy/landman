import { chromium } from "playwright"

async function validateFix() {
  console.log("Validating LandWatch fix...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  const url = "https://www.landwatch.com/montana-land-for-sale/price-50000-500000/acres-10-100"
  
  console.log(`Navigating to: ${url}`)
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
  
  await page.waitForSelector("[data-qa-listing]", { timeout: 10000 })
  await page.waitForTimeout(2000)

  const listings = await page.$$("[data-qa-listing]")
  console.log(`\nFound ${listings.length} listings\n`)

  const properties = []
  for (let i = 0; i < Math.min(listings.length, 25); i++) {
    const listing = listings[i]
    if (!listing) continue
    
    const allText = (await listing.textContent()) || ""
    const priceMatch = allText.match(/\$[\d,]+/)
    const price = priceMatch ? parseFloat(priceMatch[0].replace(/[\$,]/g, "")) : null
    const acresMatch = allText.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
    const acres = acresMatch ? parseFloat(acresMatch[1]?.replace(/,/g, "") ?? "0") : null

    if (price !== null && acres !== null) {
      properties.push({ price, acres })
    }
  }

  console.log(`Analyzed ${properties.length} properties with complete data\n`)

  let validCount = 0
  let invalidCount = 0
  const outOfRange: Array<{ price: number; acres: number }> = []

  properties.forEach((p) => {
    if (p.price >= 50000 && p.price <= 500000 && p.acres >= 10 && p.acres <= 100) {
      validCount++
    } else {
      invalidCount++
      outOfRange.push(p)
    }
  })

  console.log("=" .repeat(70))
  console.log("VALIDATION RESULTS")
  console.log("=".repeat(70))
  console.log(`Total properties: ${properties.length}`)
  console.log(`✅ Within range: ${validCount}`)
  console.log(`❌ Out of range: ${invalidCount}`)
  
  if (outOfRange.length > 0) {
    console.log("\nOut of range properties:")
    outOfRange.forEach((p) => {
      console.log(`  - Price: $${p.price.toLocaleString()}, Acres: ${p.acres}`)
    })
  }

  console.log("\n" + "=".repeat(70))
  if (invalidCount === 0) {
    console.log("✅ SUCCESS: All properties are within the specified ranges!")
    console.log("   Server-side filtering is working correctly.")
  } else {
    const percentage = ((validCount / properties.length) * 100).toFixed(1)
    console.log(`⚠️  ${percentage}% of properties are within range`)
    console.log(`   ${invalidCount} properties are outside the specified ranges`)
  }
  console.log("=".repeat(70))

  await browser.close()
}

validateFix().catch(console.error)
