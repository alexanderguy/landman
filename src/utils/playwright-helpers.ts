import { chromium, type Browser, type Page, type BrowserContext } from "playwright"
import { logger } from "./logger"

export type PlaywrightSession = {
  browser: Browser
  context: BrowserContext
  page: Page
}

export type PlaywrightOptions = {
  headless?: boolean
  userAgent?: string
  viewport?: {
    width: number
    height: number
  }
  stealth?: boolean
}

export async function launchBrowser(options: PlaywrightOptions = {}): Promise<PlaywrightSession> {
  const headless = options.headless ?? true
  const stealth = options.stealth ?? false
  const userAgent =
    options.userAgent ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

  logger.debug(`Launching browser (headless: ${headless}, stealth: ${stealth})`)

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

  const page = await context.newPage()

  return { browser, context, page }
}

export async function closeBrowser(session: PlaywrightSession): Promise<void> {
  await session.page.close()
  await session.context.close()
  await session.browser.close()
  logger.debug("Browser closed")
}

export async function navigateWithRetry(
  page: Page,
  url: string,
  maxRetries = 3,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
      return true
    } catch (error) {
      logger.warn(`Navigation attempt ${attempt}/${maxRetries} failed for ${url}: ${error}`)
      if (attempt === maxRetries) {
        logger.error(`Failed to navigate to ${url} after ${maxRetries} attempts`)
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
  return false
}

export async function waitForSelector(
  page: Page,
  selector: string,
  timeoutMs = 10000,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs })
    return true
  } catch (error) {
    logger.debug(`Selector '${selector}' not found within ${timeoutMs}ms`)
    return false
  }
}

export async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector)
    if (!element) {
      return null
    }
    return await element.textContent()
  } catch (error) {
    logger.debug(`Failed to extract text from selector '${selector}': ${error}`)
    return null
  }
}

export async function extractAttribute(
  page: Page,
  selector: string,
  attribute: string,
): Promise<string | null> {
  try {
    const element = await page.$(selector)
    if (!element) {
      return null
    }
    return await element.getAttribute(attribute)
  } catch (error) {
    logger.debug(`Failed to extract attribute '${attribute}' from selector '${selector}': ${error}`)
    return null
  }
}
