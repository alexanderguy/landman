import { chromium, type Request, type Response } from "playwright"
import { writeFileSync } from "fs"

interface ApiCall {
  timestamp: string
  method: string
  url: string
  requestHeaders: Record<string, string>
  postData?: any
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: any
  timing?: string
}

async function deepDiveLandWatchAPI() {
  console.log("=" * 80)
  console.log("LANDWATCH.COM API DEEP DIVE INVESTIGATION")
  console.log("=" * 80)
  
  const apiCalls: ApiCall[] = []
  const searchApiCalls: ApiCall[] = []
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  })
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })
  
  const page = await context.newPage()
  
  // Capture ALL network activity
  page.on('request', async (request: Request) => {
    const url = request.url()
    const call: ApiCall = {
      timestamp: new Date().toISOString(),
      method: request.method(),
      url: url,
      requestHeaders: request.headers(),
    }
    
    if (request.method() === 'POST') {
      try {
        const postData = request.postData()
        if (postData) {
          try {
            call.postData = JSON.parse(postData)
          } catch {
            call.postData = postData
          }
        }
      } catch (e) {
        console.log(`Could not get POST data: ${e}`)
      }
    }
    
    if (url.includes('/api/') || url.includes('search')) {
      console.log(`\n📤 REQUEST: ${request.method()} ${url}`)
      if (call.postData) {
        console.log(`   POST Data:`, JSON.stringify(call.postData, null, 2))
      }
      apiCalls.push(call)
    }
  })
  
  page.on('response', async (response: Response) => {
    const url = response.url()
    
    if (url.includes('/api/') || url.includes('search')) {
      console.log(`\n📥 RESPONSE: ${response.status()} ${url}`)
      
      const call = apiCalls.find(c => c.url === url && !c.responseStatus)
      if (call) {
        call.responseStatus = response.status()
        call.responseHeaders = response.headers()
        
        try {
          const contentType = response.headers()['content-type'] || ''
          if (contentType.includes('application/json')) {
            const body = await response.json()
            call.responseBody = body
            console.log(`   Response Body (first 500 chars):`, JSON.stringify(body).substring(0, 500))
            
            // If this is the search API, save it specially
            if (url.includes('/api/property/searchUrl/')) {
              searchApiCalls.push({ ...call })
              console.log(`\n🎯 FOUND SEARCH API CALL!`)
            }
          } else if (contentType.includes('text/html')) {
            const text = await response.text()
            call.responseBody = { html_length: text.length, preview: text.substring(0, 200) }
            console.log(`   HTML Response (${text.length} chars)`)
          }
        } catch (e) {
          console.log(`   Could not parse response body: ${e}`)
        }
      }
    }
  })

  try {
    // STEP 1: Load base Montana page
    console.log("\n" + "=".repeat(80))
    console.log("STEP 1: Loading base Montana page (no filters)")
    console.log("=".repeat(80))
    
    const baseUrl = "https://www.landwatch.com/montana-land-for-sale"
    console.log(`URL: ${baseUrl}`)
    console.log("Waiting for page to load...")
    
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(3000)
    
    console.log(`✅ Page loaded: ${await page.title()}`)
    console.log(`📊 API calls so far: ${apiCalls.length}`)
    
    // STEP 2: Wait for initial API calls to complete
    console.log("\n" + "=".repeat(80))
    console.log("STEP 2: Analyzing initial page load API calls")
    console.log("=".repeat(80))
    
    await page.waitForTimeout(2000)
    console.log(`Total API-like requests: ${apiCalls.length}`)
    
    const searchUrls = apiCalls.filter(c => c.url.includes('/api/property/searchUrl/'))
    console.log(`Search API calls found: ${searchUrls.length}`)
    
    if (searchUrls.length > 0) {
      console.log("\n🎯 INITIAL SEARCH API CALLS:")
      searchUrls.forEach((call, i) => {
        console.log(`\n  Call ${i + 1}:`)
        console.log(`    URL: ${call.url}`)
        console.log(`    Method: ${call.method}`)
        if (call.postData) {
          console.log(`    POST Data:`, JSON.stringify(call.postData, null, 2))
        }
        if (call.responseBody) {
          console.log(`    Response: ${JSON.stringify(call.responseBody).substring(0, 300)}...`)
        }
      })
    }
    
    await page.screenshot({ path: "data/api-investigation-step1.png", fullPage: false })
    
    // STEP 3: Look for filter UI elements
    console.log("\n" + "=".repeat(80))
    console.log("STEP 3: Looking for filter UI elements")
    console.log("=".repeat(80))
    
    // Check for filter buttons/inputs
    const filterButton = await page.$('button:has-text("Filter")')
    const moreFiltersButton = await page.$('button:has-text("More Filters")')
    const priceFilter = await page.$('[data-testid*="price"], [class*="price"]')
    
    console.log(`Filter button found: ${!!filterButton}`)
    console.log(`More Filters button found: ${!!moreFiltersButton}`)
    console.log(`Price filter element found: ${!!priceFilter}`)
    
    // STEP 4: Try to open filter panel if exists
    if (filterButton) {
      console.log("\n" + "=".repeat(80))
      console.log("STEP 4: Clicking filter button")
      console.log("=".repeat(80))
      
      await filterButton.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: "data/api-investigation-step4-filters-open.png", fullPage: false })
      
      // Look for price and acreage inputs
      console.log("\nLooking for price and acreage inputs...")
      
      const inputs = await page.$$('input[type="text"], input[type="number"]')
      console.log(`Found ${inputs.length} input fields`)
      
      for (let i = 0; i < Math.min(10, inputs.length); i++) {
        const input = inputs[i]
        const attrs = await input.evaluate((el) => ({
          name: (el as HTMLInputElement).name,
          placeholder: (el as HTMLInputElement).placeholder,
          id: el.id,
          className: el.className,
        }))
        console.log(`  Input ${i + 1}:`, attrs)
      }
    }
    
    // STEP 5: Try navigating with URL parameters
    console.log("\n" + "=".repeat(80))
    console.log("STEP 5: Testing URL parameters approach")
    console.log("=".repeat(80))
    
    // Clear previous API calls to see what's new
    const beforeParamCount = apiCalls.length
    
    const urlWithParams = "https://www.landwatch.com/montana-land-for-sale?minPrice=50000&maxPrice=500000&minAcres=10&maxAcres=100"
    console.log(`Navigating to: ${urlWithParams}`)
    
    await page.goto(urlWithParams, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(3000)
    
    console.log(`New API calls since navigation: ${apiCalls.length - beforeParamCount}`)
    
    const newSearchCalls = apiCalls.slice(beforeParamCount).filter(c => c.url.includes('/api/property/searchUrl/'))
    console.log(`New search API calls: ${newSearchCalls.length}`)
    
    if (newSearchCalls.length > 0) {
      console.log("\n🎯 NEW SEARCH API CALLS WITH URL PARAMS:")
      newSearchCalls.forEach((call, i) => {
        console.log(`\n  Call ${i + 1}:`)
        console.log(`    URL: ${call.url}`)
        console.log(`    Method: ${call.method}`)
        if (call.postData) {
          console.log(`    POST Data:`, JSON.stringify(call.postData, null, 2))
        }
      })
    }
    
    await page.screenshot({ path: "data/api-investigation-step5-with-params.png", fullPage: false })
    
    // STEP 6: Check what's actually rendered
    console.log("\n" + "=".repeat(80))
    console.log("STEP 6: Checking rendered listings")
    console.log("=".repeat(80))
    
    const listings = await page.$$('[data-qa-listing]')
    console.log(`Found ${listings.length} listings on page`)
    
    if (listings.length > 0) {
      console.log("\nFirst 5 listings:")
      for (let i = 0; i < Math.min(5, listings.length); i++) {
        const listing = listings[i]
        const text = await listing.textContent()
        const priceMatch = text?.match(/\$[\d,]+/)
        const acresMatch = text?.match(/([\d,]+(?:\.\d+)?)\s*acres/i)
        
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null
        const acres = acresMatch ? parseFloat(acresMatch[1].replace(/,/g, '')) : null
        
        console.log(`\n  Listing ${i + 1}:`)
        console.log(`    Price: ${price ? `$${price.toLocaleString()}` : 'Not found'}`)
        console.log(`    Acres: ${acres || 'Not found'}`)
        
        // Check if within our filter range
        if (price && acres) {
          const inRange = price >= 50000 && price <= 500000 && acres >= 10 && acres <= 100
          console.log(`    ✅ Within filter range: ${inRange}`)
        }
      }
    }
    
    // STEP 7: Try to manually trigger a search API call
    console.log("\n" + "=".repeat(80))
    console.log("STEP 7: Attempting to manually call the API")
    console.log("=".repeat(80))
    
    // Find the state ID from one of the API calls
    const sampleSearchCall = apiCalls.find(c => c.url.includes('/api/property/searchUrl/'))
    if (sampleSearchCall) {
      const stateIdMatch = sampleSearchCall.url.match(/searchUrl\/(\d+)/)
      if (stateIdMatch) {
        const stateId = stateIdMatch[1]
        console.log(`Found state ID for Montana: ${stateId}`)
        
        // Try making our own API call via page.evaluate
        console.log("\nAttempting manual fetch with filters...")
        
        const manualResult = await page.evaluate(async (stateId) => {
          const url = `https://www.landwatch.com/api/property/searchUrl/${stateId}`
          
          const testPayload = {
            priceMin: 50000,
            priceMax: 500000,
            acresMin: 10,
            acresMax: 100,
          }
          
          console.log(`Manual fetch to: ${url}`)
          console.log(`Payload:`, testPayload)
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(testPayload)
          })
          
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: await response.text()
          }
        }, stateId)
        
        console.log("\n📊 Manual API Call Result:")
        console.log(`  Status: ${manualResult.status} ${manualResult.statusText}`)
        console.log(`  Response preview: ${manualResult.body.substring(0, 500)}`)
        
        try {
          const parsed = JSON.parse(manualResult.body)
          console.log(`  Parsed response:`, JSON.stringify(parsed, null, 2).substring(0, 1000))
        } catch {
          console.log(`  Could not parse as JSON`)
        }
      }
    }
    
    // Keep browser open for manual inspection
    console.log("\n" + "=".repeat(80))
    console.log("Keeping browser open for 60 seconds for manual inspection...")
    console.log("You can manually interact with the page to observe API calls!")
    console.log("=".repeat(80))
    
    await page.waitForTimeout(60000)
    
  } catch (error) {
    console.error("\n❌ ERROR:", error)
    await page.screenshot({ path: "data/api-investigation-error.png" })
  } finally {
    // Save all captured data
    console.log("\n" + "=".repeat(80))
    console.log("SAVING RESULTS")
    console.log("=".repeat(80))
    
    writeFileSync("data/landwatch-all-api-calls.json", JSON.stringify(apiCalls, null, 2))
    console.log(`✅ Saved ${apiCalls.length} API calls to data/landwatch-all-api-calls.json`)
    
    if (searchApiCalls.length > 0) {
      writeFileSync("data/landwatch-search-api-calls.json", JSON.stringify(searchApiCalls, null, 2))
      console.log(`✅ Saved ${searchApiCalls.length} search API calls to data/landwatch-search-api-calls.json`)
    }
    
    // Generate summary report
    const summary = {
      totalApiCalls: apiCalls.length,
      searchApiCalls: searchApiCalls.length,
      timing: {
        firstApiCall: apiCalls[0]?.timestamp,
        lastApiCall: apiCalls[apiCalls.length - 1]?.timestamp,
      },
      searchEndpoints: [...new Set(searchApiCalls.map(c => c.url))],
      methods: [...new Set(apiCalls.map(c => c.method))],
      findings: {
        usesPostApi: searchApiCalls.some(c => c.method === 'POST'),
        apiUrlPattern: searchApiCalls[0]?.url.match(/\/api\/.*$/)?.[0],
        hasJsonResponse: searchApiCalls.some(c => c.responseBody && typeof c.responseBody === 'object'),
      }
    }
    
    writeFileSync("data/landwatch-api-summary.json", JSON.stringify(summary, null, 2))
    console.log(`✅ Saved summary to data/landwatch-api-summary.json`)
    
    await browser.close()
    console.log("\n✅ Investigation complete!")
  }
}

deepDiveLandWatchAPI().catch(console.error)
