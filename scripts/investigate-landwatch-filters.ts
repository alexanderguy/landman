import { chromium } from "playwright"

async function investigateLandWatch() {
  console.log("Launching browser in visible mode...")
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down to see what's happening
  })
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })
  
  const page = await context.newPage()
  
  // Monitor network requests
  const apiCalls: any[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('api') || url.includes('search') || url.includes('filter')) {
      console.log(`🌐 REQUEST: ${request.method()} ${url}`)
      if (request.method() === 'POST') {
        console.log(`   POST Body: ${request.postData()}`)
      }
      apiCalls.push({
        method: request.method(),
        url: url,
        postData: request.postData(),
        headers: request.headers()
      })
    }
  })
  
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('api') || url.includes('search') || url.includes('filter')) {
      console.log(`📥 RESPONSE: ${response.status()} ${url}`)
    }
  })

  try {
    // Step 1: Load base Montana page without filters
    console.log("\n=== STEP 1: Loading base Montana page ===")
    const baseUrl = "https://www.landwatch.com/montana-land-for-sale"
    console.log(`Navigating to: ${baseUrl}`)
    
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(2000)
    
    console.log(`Page Title: ${await page.title()}`)
    
    // Check if we got blocked
    const bodyText = await page.textContent('body')
    if (bodyText?.includes('Access Denied')) {
      console.log("❌ Got blocked on base URL!")
      await page.screenshot({ path: "data/landwatch-blocked.png" })
      await browser.close()
      return
    }
    
    console.log("✅ Successfully loaded page!")
    await page.screenshot({ path: "data/landwatch-step1-base.png", fullPage: false })
    
    // Step 2: Look for filter controls
    console.log("\n=== STEP 2: Looking for filter controls ===")
    
    const filterSelectors = [
      'input[name*="price"]',
      'input[name*="Price"]',
      'input[name*="acre"]',
      'input[name*="Acre"]',
      'button[data-testid*="filter"]',
      'button[class*="filter"]',
      '[data-testid*="price"]',
      '[data-testid*="acreage"]',
      '[class*="filter"]',
      '[class*="Filter"]',
    ]
    
    for (const selector of filterSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        console.log(`  ✅ Found ${count} elements matching: ${selector}`)
        const first = page.locator(selector).first()
        const attrs = await first.evaluate((el) => ({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          name: (el as any).name,
          type: (el as any).type,
          placeholder: (el as any).placeholder
        }))
        console.log(`     First element:`, JSON.stringify(attrs, null, 2))
      }
    }
    
    // Step 3: Try URL with filter parameters
    console.log("\n=== STEP 3: Testing URL parameters ===")
    const testUrl = "https://www.landwatch.com/montana-land-for-sale?minPrice=50000&maxPrice=500000&minAcres=10&maxAcres=100"
    console.log(`Navigating to: ${testUrl}`)
    
    await page.goto(testUrl, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: "data/landwatch-step3-with-params.png", fullPage: false })
    
    // Check if URL parameters are reflected in the page
    const currentUrl = page.url()
    console.log(`Current URL: ${currentUrl}`)
    console.log(`URL preserved params: ${currentUrl.includes('minPrice')}`)
    
    // Look at the first few listings to see their prices and acres
    console.log("\n=== STEP 4: Checking if filters were applied ===")
    const listings = await page.$$('[data-qa-listing]')
    console.log(`Found ${listings.length} listings`)
    
    for (let i = 0; i < Math.min(5, listings.length); i++) {
      const listing = listings[i]
      const text = await listing.textContent()
      const priceMatch = text?.match(/\$[\d,]+/)
      const acresMatch = text?.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
      console.log(`\nListing ${i + 1}:`)
      console.log(`  Price: ${priceMatch?.[0] || 'Not found'}`)
      console.log(`  Acres: ${acresMatch?.[1] || 'Not found'}`)
    }
    
    // Step 5: Save network log
    console.log("\n=== STEP 5: Network activity summary ===")
    console.log(`Total API-like requests: ${apiCalls.length}`)
    
    if (apiCalls.length > 0) {
      const fs = await import("fs")
      fs.writeFileSync("data/landwatch-network.json", JSON.stringify(apiCalls, null, 2))
      console.log("Network log saved to data/landwatch-network.json")
    }
    
    console.log("\n=== Keeping browser open for 30 seconds for manual inspection ===")
    console.log("You can manually interact with filters to see what happens!")
    await page.waitForTimeout(30000)
    
  } catch (error) {
    console.error("Error:", error)
    await page.screenshot({ path: "data/landwatch-error.png" })
  } finally {
    await browser.close()
    console.log("\nDone!")
  }
}

investigateLandWatch().catch(console.error)
