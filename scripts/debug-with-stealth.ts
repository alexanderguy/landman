import { chromium } from "playwright"

async function testWithStealth() {
  console.log("Launching browser with stealth settings...")

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certifcate-errors",
      "--ignore-certifcate-errors-spki-list",
    ],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/Denver",
    permissions: ["geolocation"],
    geolocation: { latitude: 46.8797, longitude: -110.3626 },
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })

    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: "denied" } as PermissionStatus)
        : originalQuery(parameters)

    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    })

    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    })

    ;(window as any).chrome = {
      runtime: {},
    }
  })

  const page = await context.newPage()

  console.log("Navigating to LandWatch...")
  const url = "https://www.landwatch.com/montana-land-for-sale"

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })

    const title = await page.title()
    console.log(`Page title: ${title}`)

    if (title.toLowerCase().includes("denied")) {
      console.log("❌ Still blocked")
    } else {
      console.log("✅ Success!")

      const propertyLinks = await page.locator("a[href*='/land/']").count()
      console.log(`Found ${propertyLinks} property links`)
    }

    await page.screenshot({ path: "data/debug-stealth.png" })

    console.log("\nLeaving browser open for 10 seconds so you can inspect...")
    await page.waitForTimeout(10000)
  } catch (error) {
    console.log(`Error: ${error}`)
  }

  await browser.close()
}

testWithStealth().catch(console.error)
