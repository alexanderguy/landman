import { launchBrowser } from "../src/utils/playwright-helpers"

async function watchURL() {
  console.log("Opening Zillow - watching for URL changes...\n")

  const searchURL = `https://www.zillow.com/mt/land/`

  const session = await launchBrowser({ headless: false, stealth: true })

  let lastURL = ""

  // Watch for URL changes
  session.page.on("framenavigated", async (frame) => {
    if (frame === session.page.mainFrame()) {
      const currentURL = session.page.url()
      if (currentURL !== lastURL) {
        lastURL = currentURL
        console.log("\n" + "=".repeat(80))
        console.log("URL CHANGED:")
        console.log(currentURL)
        
        try {
          const urlObj = new URL(currentURL)
          const searchQueryState = urlObj.searchParams.get("searchQueryState")
          if (searchQueryState) {
            console.log("\nDecoded searchQueryState:")
            console.log(JSON.stringify(JSON.parse(searchQueryState), null, 2))
          }
        } catch {
          // ignore parse errors
        }
        console.log("=".repeat(80))
      }
    }
  })

  await session.page.goto(searchURL)
  console.log("Starting URL:", searchURL)
  console.log("\nPlease set filters in the browser. I'll show URL changes as they happen.\n")

  // Keep browser open
  await new Promise(() => {})
}

watchURL().catch(console.error)
