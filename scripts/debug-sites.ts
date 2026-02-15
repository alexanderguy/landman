import { chromium } from "playwright"

async function debugSite(siteName: string, url: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Testing: ${siteName}`)
  console.log(`URL: ${url}`)
  console.log("=".repeat(60))

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/Denver",
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
  })

  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })

    const title = await page.title()
    console.log(`Page title: ${title}`)

    if (title.toLowerCase().includes("denied") || title.toLowerCase().includes("blocked")) {
      console.log("❌ BLOCKED by bot detection")
      await page.screenshot({ path: `data/debug-${siteName}.png` })
      await browser.close()
      return false
    }

    console.log("✅ Page loaded successfully")

    const selectors = [
      "a[href*='/land/']",
      "a[href*='/property/']",
      "[class*='listing']",
      "[class*='property']",
      "[class*='card']",
      "article",
    ]

    console.log("\nSearching for property elements:")
    for (const selector of selectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        console.log(`  ✅ ${selector}: ${count} elements`)
      }
    }

    const links = await page.$$eval("a", (anchors) =>
      anchors
        .filter((a) => a.href && (a.href.includes("/land/") || a.href.includes("/property/")))
        .slice(0, 3)
        .map((a) => ({ href: a.href, text: a.textContent?.trim().slice(0, 60) })),
    )

    if (links.length > 0) {
      console.log("\nSample property links:")
      for (const link of links) {
        console.log(`  - ${link.text}`)
        console.log(`    ${link.href}`)
      }
    }

    await page.screenshot({ path: `data/debug-${siteName}.png` })
    console.log(`Screenshot saved to data/debug-${siteName}.png`)

    await browser.close()
    return true
  } catch (error) {
    console.log(`❌ Error: ${error}`)
    await browser.close()
    return false
  }
}

async function main() {
  const sites = [
    {
      name: "landwatch",
      url: "https://www.landwatch.com/montana-land-for-sale",
    },
    {
      name: "landsofamerica",
      url: "https://www.landsofamerica.com/Montana/all-land/",
    },
    {
      name: "landandfarm",
      url: "https://www.landandfarm.com/search/MT/all-land-for-sale/",
    },
  ]

  const results: Record<string, boolean> = {}

  for (const site of sites) {
    results[site.name] = await debugSite(site.name, site.url)
  }

  console.log("\n" + "=".repeat(60))
  console.log("SUMMARY")
  console.log("=".repeat(60))
  for (const [name, success] of Object.entries(results)) {
    console.log(`  ${success ? "✅" : "❌"} ${name}`)
  }
}

main().catch(console.error)
