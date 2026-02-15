import { chromium } from "playwright"

async function watchManualTest() {
  console.log("Launching browser for manual inspection...")
  console.log("=" .repeat(70))
  console.log("Browser will open to land.com Montana page")
  console.log("Perform your searches and I'll log URL changes")
  console.log("Close the browser window when done")
  console.log("=" .repeat(70))
  console.log("")

  const browser = await chromium.launch({ 
    headless: false,
  })
  
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  // Log URL changes
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`\n🔗 URL Changed: ${frame.url()}`)
    }
  })

  // Log network requests
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('land.com') && !url.includes('.css') && !url.includes('.js') && !url.includes('.png') && !url.includes('.jpg')) {
      console.log(`📡 Request: ${request.method()} ${url}`)
    }
  })

  const startUrl = "https://www.land.com/Montana/all-land/"
  console.log(`Starting URL: ${startUrl}\n`)
  
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
  
  console.log("\n✅ Browser is ready. Perform your manual searches now...")
  console.log("   I'm watching URL changes and network requests.\n")

  // Wait for browser to close
  await page.waitForEvent('close', { timeout: 0 }).catch(() => {})
  
  console.log("\n✅ Browser closed. Analysis complete.")
  await browser.close()
}

watchManualTest().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
