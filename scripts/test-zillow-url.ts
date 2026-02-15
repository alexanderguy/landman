import { ConfigManager } from "../src/utils/config"
import path from "path"

// Test what URLs are being built for Zillow
const configPath = path.join(process.cwd(), "config", "search-criteria.json")
const configManager = new ConfigManager(configPath)
const profile = configManager.getActiveProfile()

console.log("Active profile:", profile.name)
console.log("States to search:", profile.criteria.states)
console.log("\n")

const STATE_REGION_IDS: Record<string, number> = {
  AL: 4, AK: 3, AZ: 7, AR: 6, CA: 9, CO: 10, CT: 11, DE: 13, FL: 14, GA: 16,
  HI: 17, ID: 18, IL: 19, IN: 20, IA: 21, KS: 22, KY: 23, LA: 24, ME: 26,
  MD: 27, MA: 28, MI: 29, MN: 30, MS: 31, MO: 32, MT: 35, NE: 36, NV: 37,
  NH: 38, NJ: 39, NM: 40, NY: 41, NC: 42, ND: 43, OH: 44, OK: 45, OR: 46,
  PA: 47, RI: 49, SC: 50, SD: 51, TN: 52, TX: 53, UT: 54, VT: 55, VA: 56,
  WA: 57, WV: 58, WI: 59, WY: 60,
}

const STATE_SLUGS: Record<string, string> = {
  AL: "al", AK: "ak", AZ: "az", AR: "ar", CA: "ca", CO: "co", CT: "ct", DE: "de",
  FL: "fl", GA: "ga", HI: "hi", ID: "id", IL: "il", IN: "in", IA: "ia", KS: "ks",
  KY: "ky", LA: "la", ME: "me", MD: "md", MA: "ma", MI: "mi", MN: "mn", MS: "ms",
  MO: "mo", MT: "mt", NE: "ne", NV: "nv", NH: "nh", NJ: "nj", NM: "nm", NY: "ny",
  NC: "nc", ND: "nd", OH: "oh", OK: "ok", OR: "or", PA: "pa", RI: "ri", SC: "sc",
  SD: "sd", TN: "tn", TX: "tx", UT: "ut", VT: "vt", VA: "va", WA: "wa", WV: "wv",
  WI: "wi", WY: "wy",
}

for (const state of profile.criteria.states) {
  const stateUpper = state.toUpperCase()
  const regionId = STATE_REGION_IDS[stateUpper]
  const slug = STATE_SLUGS[stateUpper]
  
  console.log(`State: ${state}`)
  console.log(`  Region ID: ${regionId}`)
  console.log(`  Slug: ${slug}`)
  console.log(`  Base URL: https://www.zillow.com/${slug}/land/`)
  console.log("")
}
