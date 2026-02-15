import { chromium } from "playwright"

async function testDirectUrlConstruction() {
  console.log("Testing direct URL construction for LandWatch filtering...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  const tests = [
    {
      name: "Montana with price and acreage filters",
      url: "https://www.landwatch.com/montana-land-for-sale/price-50000-500000/acres-10-100",
      expectedPriceRange: { min: 50000, max: 500000 },
      expectedAcresRange: { min: 10, max: 100 },
    },
    {
      name: "Wyoming with same filters",
      url: "https://www.landwatch.com/wyoming-land-for-sale/price-50000-500000/acres-10-100",
      expectedPriceRange: { min: 50000, max: 500000 },
      expectedAcresRange: { min: 10, max: 100 },
    },
    {
      name: "Montana with price filter only",
      url: "https://www.landwatch.com/montana-land-for-sale/price-50000-500000",
      expectedPriceRange: { min: 50000, max: 500000 },
      expectedAcresRange: null,
    },
    {
      name: "Montana with acres filter only",
      url: "https://www.landwatch.com/montana-land-for-sale/acres-10-100",
      expectedPriceRange: null,
      expectedAcresRange: { min: 10, max: 100 },
    },
  ]

  for (const test of tests) {
    console.log("=" .repeat(70))
    console.log(`Test: ${test.name}`)
    console.log(`URL: ${test.url}`)
    console.log("=".repeat(70))

    try {
      await page.goto(test.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })

      await page.waitForSelector("[data-qa-listing]", { timeout: 10000 })
      await page.waitForTimeout(2000)

      const listings = await page.$$("[data-qa-listing]")
      console.log(`✓ Found ${listings.length} listings on page\n`)

      const properties = []
      for (let i = 0; i < Math.min(listings.length, 10); i++) {
        const listing = listings[i]
        if (!listing) continue
        
        const allText = (await listing.textContent()) || ""

        const priceMatch = allText.match(/\$[\d,]+/)
        const price = priceMatch
          ? parseFloat(priceMatch[0].replace(/[\$,]/g, ""))
          : null

        const acresMatch = allText.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
        const acres = acresMatch ? parseFloat(acresMatch[1]?.replace(/,/g, "") ?? "0") : null

        if (price !== null || acres !== null) {
          properties.push({ price, acres })
        }
      }

      console.log("Sample properties (first 10):")
      properties.forEach((p, idx) => {
        console.log(
          `  ${idx + 1}. Price: ${p.price ? `$${p.price.toLocaleString()}` : "N/A"}, Acres: ${p.acres ?? "N/A"}`
        )
      })

      let validPrice = 0
      let invalidPrice = 0
      let validAcres = 0
      let invalidAcres = 0

      properties.forEach((p) => {
        if (test.expectedPriceRange && p.price !== null) {
          if (
            p.price >= test.expectedPriceRange.min &&
            p.price <= test.expectedPriceRange.max
          ) {
            validPrice++
          } else {
            invalidPrice++
          }
        }

        if (test.expectedAcresRange && p.acres !== null) {
          if (
            p.acres >= test.expectedAcresRange.min &&
            p.acres <= test.expectedAcresRange.max
          ) {
            validAcres++
          } else {
            invalidAcres++
          }
        }
      })

      console.log("\nValidation Results:")
      if (test.expectedPriceRange) {
        console.log(
          `  Price filter: ${validPrice} valid, ${invalidPrice} invalid (out of ${validPrice + invalidPrice} with price data)`
        )
        if (invalidPrice > 0) {
          console.log(
            `  ❌ FAIL: Found properties outside price range ${test.expectedPriceRange.min}-${test.expectedPriceRange.max}`
          )
        } else {
          console.log(`  ✅ PASS: All properties within price range`)
        }
      }

      if (test.expectedAcresRange) {
        console.log(
          `  Acres filter: ${validAcres} valid, ${invalidAcres} invalid (out of ${validAcres + invalidAcres} with acres data)`
        )
        if (invalidAcres > 0) {
          console.log(
            `  ❌ FAIL: Found properties outside acreage range ${test.expectedAcresRange.min}-${test.expectedAcresRange.max}`
          )
        } else {
          console.log(`  ✅ PASS: All properties within acreage range`)
        }
      }

      const nextButton = await page.$("[data-testid='next']")
      if (nextButton) {
        const isDisabled = await nextButton.getAttribute("disabled")
        if (!isDisabled) {
          console.log("\n  Testing pagination...")
          const urlBeforeClick = page.url()
          await nextButton.click()
          await page.waitForTimeout(3000)
          const urlAfterClick = page.url()
          console.log(`  URL before pagination: ${urlBeforeClick}`)
          console.log(`  URL after pagination: ${urlAfterClick}`)
          if (urlAfterClick.includes("price-") || urlAfterClick.includes("acres-")) {
            console.log(`  ✅ PASS: Filters preserved in pagination`)
          } else {
            console.log(`  ⚠️  WARNING: Filters might not be preserved`)
          }
        }
      }

      console.log("")
    } catch (error) {
      console.log(`❌ ERROR: ${error}\n`)
    }
  }

  await browser.close()
  console.log("\n✅ Testing complete!")
}

testDirectUrlConstruction().catch(console.error)
