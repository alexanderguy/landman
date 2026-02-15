import { launchBrowser } from "../src/utils/playwright-helpers"

async function testURL() {
  console.log("Testing exact URL from plugin...\n")

  // This is the exact URL the plugin generates
  const myURL = `https://www.zillow.com/mt/land/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A35%2C%22regionType%22%3A2%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22sf%22%3A%7B%22value%22%3Afalse%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22lot%22%3A%7B%22min%22%3A435600%2C%22max%22%3A4356000%7D%7D%2C%22isListVisible%22%3Atrue%2C%22usersSearchTerm%22%3A%22MT%22%7D`

  const session = await launchBrowser({ headless: false, stealth: true })

  let urlChangeCount = 0
  
  session.page.on("framenavigated", async (frame) => {
    if (frame === session.page.mainFrame()) {
      urlChangeCount++
      const currentURL = session.page.url()
      console.log(`\n[${ urlChangeCount }] URL after navigation:`)
      console.log(currentURL.substring(0, 200) + '...')
      
      const urlObj = new URL(currentURL)
      const sq = urlObj.searchParams.get("searchQueryState")
      if (sq) {
        const parsed = JSON.parse(sq)
        console.log("\nPrice filter:", parsed.filterState?.price)
        console.log("Lot filter:", parsed.filterState?.lot)
      }
    }
  })

  console.log("Navigating to MY URL:")
  console.log(myURL)
  console.log("")

  await session.page.goto(myURL)
  await session.page.waitForTimeout(8000)

  console.log("\n\nLook at the browser - are the filters shown correctly in the UI?")
  console.log("Check: Price $50k-$500k, Lot 10-100 acres")
  console.log("\nPress Ctrl+C when done...")
  await new Promise(() => {})
}

testURL().catch(console.error)
