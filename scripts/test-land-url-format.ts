import { chromium } from "playwright"

async function testLandUrlFormat() {
  console.log("Testing land.com URL format...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const tests = [
    {
      name: "Query params (current broken approach)",
      url: "https://www.land.com/Montana/all-land/?MinPrice=50000&MaxPrice=500000&MinAcreage=10&MaxAcreage=100",
    },
    {
      name: "Path-based like LandWatch",
      url: "https://www.land.com/Montana/all-land/price-50000-500000/acres-10-100",
    },
    {
      name: "Just state + price filter",
      url: "https://www.land.com/Montana/all-land/price-50000-500000",
    },
    {
      name: "Land.com montana path",
      url: "https://www.land.com/montana-land-for-sale/price-50000-500000/acres-10-100",
    },
  ]

  for (const test of tests) {
    console.log("=".repeat(70))
    console.log(test.name)
    console.log(`URL: ${test.url}`)
    console.log("=".repeat(70))

    const page = await context.newPage()

    try {
      await page.goto(test.url, { waitUntil: "domcontentloaded", timeout: 30000 })
      
      const finalUrl = page.url()
      console.log(`Final URL: ${finalUrl}`)
      
      await page.waitForTimeout(3000)
      
      const listings = await page.$$("[data-qa-listing]")
      console.log(`Found ${listings.length} listings`)
      
      if (listings.length > 0) {
        const firstListing = listings[0]
        const text = await firstListing?.textContent()
        const priceMatch = text?.match(/\$[\d,]+/)
        const acresMatch = text?.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
        console.log(`Sample property:`)
        console.log(`  Price: ${priceMatch?.[0] ?? "N/A"}`)
        console.log(`  Acres: ${acresMatch?.[1] ?? "N/A"}`)
      }
      
    } catch (error) {
      console.log(`Error: ${error}`)
    }

    await page.close()
    console.log("")
  }

  await browser.close()
}

testLandUrlFormat().catch(console.error)
