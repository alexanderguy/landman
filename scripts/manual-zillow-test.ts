import { launchBrowser } from "../src/utils/playwright-helpers"

async function manualTest() {
  console.log("Opening Zillow with current URL format...")
  console.log("You can manually adjust filters in the browser")
  console.log("Then copy the URL to see the correct format\n")

  const searchURL = `https://www.zillow.com/mt/land/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A35%2C%22regionType%22%3A2%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22sf%22%3A%7B%22value%22%3Afalse%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22lot%22%3A%7B%22min%22%3A435600%2C%22max%22%3A4356000%7D%7D%2C%22isListVisible%22%3Atrue%7D`

  console.log("Current URL:")
  console.log(searchURL)
  console.log("\nDecoded searchQueryState:")
  const params = new URLSearchParams(searchURL.split('?')[1])
  const searchQueryState = params.get('searchQueryState')
  if (searchQueryState) {
    console.log(JSON.stringify(JSON.parse(searchQueryState), null, 2))
  }

  const session = await launchBrowser({ headless: false, stealth: true })

  await session.page.goto(searchURL)

  console.log("\n\nBrowser is open. Please:")
  console.log("1. Manually set filters: Price $50k-$500k, Lot 10-100 acres")
  console.log("2. Copy the URL from the address bar")
  console.log("3. Press Ctrl+C to exit")
  console.log("\nWaiting indefinitely...")

  // Keep browser open
  await new Promise(() => {})
}

manualTest().catch(console.error)
