import { chromium } from "playwright"
import { writeFileSync } from "fs"

async function captureApiResponse() {
  console.log("Starting API response capture...")
  
  const browser = await chromium.launch({ 
    headless: false,
  })
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })
  
  const page = await context.newPage()
  
  let searchApiResponse: any = null
  
  // Listen specifically for the search API response
  page.on('response', async (response) => {
    const url = response.url()
    
    if (url.includes('/api/property/searchUrl/') && response.request().method() === 'POST') {
      console.log(`\n🎯 CAPTURED SEARCH API RESPONSE!`)
      console.log(`   URL: ${url}`)
      console.log(`   Status: ${response.status()}`)
      console.log(`   Content-Type: ${response.headers()['content-type']}`)
      
      try {
        // Try to read as text first
        const text = await response.text()
        console.log(`   Body length: ${text.length} chars`)
        console.log(`   Body preview: ${text.substring(0, 200)}`)
        
        searchApiResponse = {
          url: url,
          status: response.status(),
          headers: response.headers(),
          bodyText: text,
        }
        
        // Try to parse as JSON
        try {
          const json = JSON.parse(text)
          searchApiResponse.bodyJson = json
          console.log(`   ✅ Parsed as JSON:`, JSON.stringify(json, null, 2).substring(0, 500))
        } catch {
          console.log(`   ℹ️  Not JSON format`)
        }
        
      } catch (error) {
        console.log(`   ❌ Error reading response: ${error}`)
      }
    }
  })

  try {
    console.log("\nNavigating to Montana land page...")
    await page.goto("https://www.landwatch.com/montana-land-for-sale", { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    })
    
    console.log("Waiting for listings to appear...")
    await page.waitForSelector('[data-qa-listing]', { timeout: 20000 })
    
    console.log("✅ Page loaded successfully!")
    
    // Give time for any additional API calls
    await page.waitForTimeout(2000)
    
    if (searchApiResponse) {
      writeFileSync('data/search-api-response.json', JSON.stringify(searchApiResponse, null, 2))
      console.log("\n✅ Saved API response to data/search-api-response.json")
      
      // Now try calling the API manually with filters
      console.log("\n" + "=".repeat(80))
      console.log("Testing manual API call with filters...")
      console.log("=".repeat(80))
      
      const manualCall = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/property/searchUrl/1113', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/plain'
            },
            body: JSON.stringify({
              acresMax: 100,
              acresMin: 10,
              activityTypes: [],
              amenityTypes: [],
              bathMax: null,
              bathMin: null,
              bedMax: null,
              bedMin: null,
              cityIdList: [],
              cityName: "",
              countyIdList: [],
              countyName: "",
              customSearchUrl: "",
              dateListed: 0,
              hasCustomMap: false,
              hasHouse: null,
              hasVideo: false,
              hasVirtualTour: false,
              inventoryIdList: [],
              isDefaultGeoSearch: false,
              isDefaultStateAndTypeSearch: false,
              isDefaultStateSearch: false,
              isNearMeSearch: false,
              isSellerSearchPage: false,
              keywordQuery: null,
              lakeIdList: [],
              latitude: null,
              longitude: null,
              marketStatuses: [1, 2],
              mineralRights: false,
              ownerFinancing: false,
              pageIndex: 0,
              priceMax: 500000,
              priceMin: 50000,
              priceChangeLookback: 0,
              priceChangeType: 0,
              propertyTypes: [],
              radius: 0,
              regionIdList: [],
              regionName: "",
              sortOrderId: 0,
              sqftMax: null,
              sqftMin: null,
              stateAbbreviation: "MT",
              stateId: 30,
              stateName: "Montana",
              transactionTypes: [],
              zip: "",
              userSavedProperties: false,
              brokerId: 0,
              mapEncodedCords: "",
              tempSkipNavigation: false
            })
          })
          
          const text = await response.text()
          
          return {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            body: text
          }
        } catch (error: any) {
          return {
            error: error.message
          }
        }
      })
      
      console.log("\n📊 Manual API Call Result:")
      console.log(JSON.stringify(manualCall, null, 2))
      
      writeFileSync('data/manual-api-call.json', JSON.stringify(manualCall, null, 2))
      console.log("✅ Saved manual call result to data/manual-api-call.json")
      
      // If we got a URL, try navigating to it
      if (manualCall.body && manualCall.body.startsWith('/')) {
        console.log(`\n🔍 Response looks like a URL: ${manualCall.body}`)
        console.log("Navigating to this URL to see what it returns...")
        
        const fullUrl = `https://www.landwatch.com${manualCall.body}`
        await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 20000 })
        await page.waitForTimeout(2000)
        
        const listingCount = await page.$$eval('[data-qa-listing]', els => els.length)
        console.log(`Found ${listingCount} listings on filtered page`)
        
        await page.screenshot({ path: 'data/filtered-results.png' })
        console.log("✅ Saved screenshot to data/filtered-results.png")
      }
    } else {
      console.log("\n❌ No search API response was captured")
    }
    
  } catch (error) {
    console.error("\n❌ ERROR:", error)
  } finally {
    await browser.close()
    console.log("\n✅ Done!")
  }
}

captureApiResponse().catch(console.error)
