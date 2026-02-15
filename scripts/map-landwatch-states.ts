import { chromium } from "playwright"
import { writeFileSync } from "fs"

type StateInfo = {
  searchUrlId: string
  fipsCode: number
  name: string
  slug: string
}

const US_STATES: Record<string, { fips: number; name: string }> = {
  AL: { fips: 1, name: "Alabama" },
  AK: { fips: 2, name: "Alaska" },
  AZ: { fips: 4, name: "Arizona" },
  AR: { fips: 5, name: "Arkansas" },
  CA: { fips: 6, name: "California" },
  CO: { fips: 8, name: "Colorado" },
  CT: { fips: 9, name: "Connecticut" },
  DE: { fips: 10, name: "Delaware" },
  FL: { fips: 12, name: "Florida" },
  GA: { fips: 13, name: "Georgia" },
  HI: { fips: 15, name: "Hawaii" },
  ID: { fips: 16, name: "Idaho" },
  IL: { fips: 17, name: "Illinois" },
  IN: { fips: 18, name: "Indiana" },
  IA: { fips: 19, name: "Iowa" },
  KS: { fips: 20, name: "Kansas" },
  KY: { fips: 21, name: "Kentucky" },
  LA: { fips: 22, name: "Louisiana" },
  ME: { fips: 23, name: "Maine" },
  MD: { fips: 24, name: "Maryland" },
  MA: { fips: 25, name: "Massachusetts" },
  MI: { fips: 26, name: "Michigan" },
  MN: { fips: 27, name: "Minnesota" },
  MS: { fips: 28, name: "Mississippi" },
  MO: { fips: 29, name: "Missouri" },
  MT: { fips: 30, name: "Montana" },
  NE: { fips: 31, name: "Nebraska" },
  NV: { fips: 32, name: "Nevada" },
  NH: { fips: 33, name: "New Hampshire" },
  NJ: { fips: 34, name: "New Jersey" },
  NM: { fips: 35, name: "New Mexico" },
  NY: { fips: 36, name: "New York" },
  NC: { fips: 37, name: "North Carolina" },
  ND: { fips: 38, name: "North Dakota" },
  OH: { fips: 39, name: "Ohio" },
  OK: { fips: 40, name: "Oklahoma" },
  OR: { fips: 41, name: "Oregon" },
  PA: { fips: 42, name: "Pennsylvania" },
  RI: { fips: 44, name: "Rhode Island" },
  SC: { fips: 45, name: "South Carolina" },
  SD: { fips: 46, name: "South Dakota" },
  TN: { fips: 47, name: "Tennessee" },
  TX: { fips: 48, name: "Texas" },
  UT: { fips: 49, name: "Utah" },
  VT: { fips: 50, name: "Vermont" },
  VA: { fips: 51, name: "Virginia" },
  WA: { fips: 53, name: "Washington" },
  WV: { fips: 54, name: "West Virginia" },
  WI: { fips: 55, name: "Wisconsin" },
  WY: { fips: 56, name: "Wyoming" },
}

async function discoverStateIds() {
  console.log("Starting LandWatch state ID discovery...\n")

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  })

  const results: Record<string, StateInfo> = {}
  const failed: string[] = []

  const entries = Object.entries(US_STATES)
  let completed = 0

  for (const [abbr, info] of entries) {
    const page = await context.newPage()

    let searchUrlId: string | null = null

    page.on("request", (request) => {
      const url = request.url()
      const match = url.match(/\/api\/property\/searchUrl\/(\d+)/)
      if (match && match[1] && request.method() === "POST") {
        searchUrlId = match[1]
      }
    })

    const slug = info.name.toLowerCase().replace(/\s+/g, "-")

    try {
      await page.goto(`https://www.landwatch.com/${slug}-land-for-sale`, {
        waitUntil: "networkidle",
        timeout: 30000,
      })

      await page.waitForTimeout(2000)

      if (searchUrlId) {
        results[abbr] = {
          searchUrlId,
          fipsCode: info.fips,
          name: info.name,
          slug,
        }
        console.log(`✓ ${abbr} (${info.name}): ${searchUrlId}`)
      } else {
        failed.push(abbr)
        console.log(`✗ ${abbr} (${info.name}): No API call detected`)
      }
    } catch (error) {
      failed.push(abbr)
      console.log(`✗ ${abbr} (${info.name}): Error - ${error}`)
    }

    await page.close()
    completed++

    if (completed % 10 === 0) {
      console.log(`\n--- Progress: ${completed}/${entries.length} states ---\n`)
    }
  }

  await browser.close()

  console.log("\n" + "=".repeat(60))
  console.log(`✅ Successfully mapped: ${Object.keys(results).length}/50 states`)
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.join(", ")}`)
  }

  writeFileSync("data/landwatch-state-mapping.json", JSON.stringify(results, null, 2))
  console.log("\n✅ Saved to data/landwatch-state-mapping.json")

  const tsCode = `export type StateInfo = {
  searchUrlId: string
  fipsCode: number
  name: string
  slug: string
}

export const STATE_INFO: Record<string, StateInfo> = ${JSON.stringify(results, null, 2)} as const
`
  writeFileSync("data/landwatch-state-mapping.ts", tsCode)
  console.log("✅ Saved TypeScript to data/landwatch-state-mapping.ts")

  console.log("\nState mapping complete!")
}

discoverStateIds().catch(console.error)
