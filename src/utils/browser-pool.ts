import { chromium, type Browser, type Page, type BrowserContext } from "playwright"
import { logger } from "./logger"
import type { PlaywrightOptions } from "./playwright-helpers"

export type BrowserPool = {
  browser: Browser
  context: BrowserContext
  createPage: () => Promise<Page>
  close: () => Promise<void>
}

/**
 * Creates a shared browser instance with one context.
 * Multiple pages (tabs) can be created in the same browser window.
 * This allows parallel scraping while sharing the same browser window.
 */
export async function createBrowserPool(options: PlaywrightOptions = {}): Promise<BrowserPool> {
  const headless = options.headless ?? true
  const stealth = options.stealth ?? false
  const userAgent =
    options.userAgent ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

  logger.debug(`Launching shared browser (headless: ${headless}, stealth: ${stealth})`)

  const launchArgs = stealth
    ? [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
        "--no-sandbox",
      ]
    : []

  const browser = await chromium.launch({
    headless,
    args: launchArgs,
  })

  const contextOptions: Parameters<Browser["newContext"]>[0] = {
    userAgent,
    viewport: options.viewport ?? { width: 1920, height: 1080 },
  }

  if (stealth) {
    contextOptions.locale = "en-US"
    contextOptions.timezoneId = "America/Los_Angeles"
    contextOptions.extraHTTPHeaders = {
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    }
  }

  const context = await browser.newContext(contextOptions)

  if (stealth) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined })
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] })
    })
  }

  const createPage = async () => {
    const page = await context.newPage()
    logger.debug("Created new tab in shared browser")
    return page
  }

  const close = async () => {
    await context.close()
    await browser.close()
    logger.debug("Browser pool closed")
  }

  return {
    browser,
    context,
    createPage,
    close,
  }
}
