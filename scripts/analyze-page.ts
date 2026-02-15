import { chromium } from "playwright"
import { writeFileSync } from "fs"

async function analyzePage() {
  const log: string[] = []
  const logLine = (msg: string) => {
    console.log(msg)
    log.push(msg)
  }

  const browser = await chromium.launch({ headless: false })
  const page = await (await browser.newContext()).newPage()

  logLine("Opening LandWatch Montana search...")
  
  try {
    await page.goto("https://www.landwatch.com/mt-land-for-sale?maxPrice=1200000&minAcres=20", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    logLine("✅ Page navigation completed")
  } catch (error) {
    logLine(`⚠️  Navigation timeout, but continuing anyway: ${error}`)
  }

  logLine("\n⏳ Waiting 10 seconds for content to load...")
  await page.waitForTimeout(10000)

  logLine("\n📸 Taking screenshot...")
  await page.screenshot({ path: "data/landwatch-screenshot.png", fullPage: true })
  logLine("   Saved to data/landwatch-screenshot.png")

  logLine("\n📊 Testing selectors:")
  
  const selectors = [
    'a[href*="land-for-sale"]',
    'a[href*="/land/"]',
    '.listing-item',
    '.property-item',
    '.search-result',
    'div[class*="Land"]',
    'div[class*="Property"]',
    'div[class*="Result"]',
    'div[class*="Card"]',
    'div[class*="listing"]',
    'article',
    '[data-testid]',
  ]

  for (const sel of selectors) {
    const count = await page.locator(sel).count()
    if (count > 0) {
      logLine(`  ✅ "${sel}" = ${count} matches`)
      
      try {
        const firstClasses = await page.locator(sel).first().getAttribute("class")
        if (firstClasses) {
          logLine(`     Classes: ${firstClasses}`)
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  logLine("\n🔍 Extracting sample links...")
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'))
    return anchors
      .filter(a => a.href && a.href.includes('land'))
      .slice(0, 5)
      .map(a => ({
        href: a.href,
        text: a.textContent?.trim().substring(0, 80) || '',
        classes: a.className,
      }))
  })

  if (links.length > 0) {
    logLine(`\n   Found ${links.length} sample links:`)
    for (const link of links) {
      logLine(`   - Text: ${link.text}`)
      logLine(`     URL: ${link.href}`)
      logLine(`     Classes: ${link.classes}`)
    }
  } else {
    logLine("   ❌ No links with 'land' in URL found")
  }

  logLine("\n💾 Saving full HTML...")
  const html = await page.content()
  writeFileSync("data/landwatch-page.html", html)
  logLine("   Saved to data/landwatch-page.html")

  logLine("\n✅ Analysis complete!")
  logLine("   - Screenshot: data/landwatch-screenshot.png")
  logLine("   - HTML: data/landwatch-page.html")
  logLine("   - Log: data/page-analysis.log")

  writeFileSync("data/page-analysis.log", log.join("\n"))

  await browser.close()
}

analyzePage().catch(error => {
  console.error("Script error:", error)
  writeFileSync("data/page-analysis.log", `ERROR: ${error}\n`)
})
