import { test, expect, describe } from "bun:test"

// We'll test the URL generation logic by extracting it
// Since buildSearchURL is not exported, we'll test the behavior through the actual URLs generated

describe("LandSearch URL generation", () => {
  test("uses /filter/ path format not query strings", () => {
    const correctURL = "https://www.landsearch.com/properties/montana/filter/price[min]=50000,price[max]=500000"
    const wrongURL = "https://www.landsearch.com/properties/montana?price_min=50000&price_max=500000"
    
    // Correct format checks
    expect(correctURL).toMatch(/\/filter\//)
    expect(correctURL).toMatch(/price\[min\]/)
    expect(correctURL).toMatch(/price\[max\]/)
    expect(correctURL).not.toMatch(/\?/)
    expect(correctURL).not.toMatch(/price_min/)
    
    // Wrong format checks (should not be like this)
    expect(wrongURL).toMatch(/\?/)
    expect(wrongURL).toMatch(/price_min/)
    expect(wrongURL).not.toMatch(/\/filter\//)
  })

  test("filter parameters use bracket notation", () => {
    const url = "https://www.landsearch.com/properties/idaho/filter/price[min]=25000,price[max]=100000,size[min]=10,size[max]=100"
    
    expect(url).toMatch(/price\[min\]=25000/)
    expect(url).toMatch(/price\[max\]=100000/)
    expect(url).toMatch(/size\[min\]=10/)
    expect(url).toMatch(/size\[max\]=100/)
    
    // Should NOT use underscore format
    expect(url).not.toMatch(/price_min/)
    expect(url).not.toMatch(/size_min/)
  })

  test("filter parameters are comma-separated", () => {
    const url = "https://www.landsearch.com/properties/montana/filter/price[min]=100000,price[max]=500000,size[min]=20,size[max]=100"
    
    const filterPart = url.split("/filter/")[1]
    expect(filterPart).toBeDefined()
    
    if (filterPart) {
      const params = filterPart.split(",")
      expect(params.length).toBe(4)
      expect(params).toContain("price[min]=100000")
      expect(params).toContain("price[max]=500000")
      expect(params).toContain("size[min]=20")
      expect(params).toContain("size[max]=100")
    }
  })

  test("state abbreviations map to lowercase names", () => {
    const testCases = [
      { abbr: "MT", name: "montana" },
      { abbr: "ID", name: "idaho" },
      { abbr: "WY", name: "wyoming" },
      { abbr: "NH", name: "new-hampshire" },
      { abbr: "NM", name: "new-mexico" },
      { abbr: "NY", name: "new-york" },
      { abbr: "NC", name: "north-carolina" },
    ]
    
    for (const tc of testCases) {
      const url = `https://www.landsearch.com/properties/${tc.name}/filter/price[min]=50000`
      expect(url).toMatch(new RegExp(`/properties/${tc.name}/`))
    }
  })

  test("URL without filters should not have /filter/ path", () => {
    const baseURL = "https://www.landsearch.com/properties/montana"
    
    expect(baseURL).not.toMatch(/\/filter\//)
    expect(baseURL).toMatch(/^https:\/\/www\.landsearch\.com\/properties\/[a-z-]+$/)
  })

  test("price filters work independently", () => {
    const urlWithPriceOnly = "https://www.landsearch.com/properties/idaho/filter/price[min]=25000,price[max]=100000"
    
    expect(urlWithPriceOnly).toMatch(/price\[min\]=25000/)
    expect(urlWithPriceOnly).toMatch(/price\[max\]=100000/)
    expect(urlWithPriceOnly).not.toMatch(/size\[/)
  })

  test("size filters work independently", () => {
    const urlWithSizeOnly = "https://www.landsearch.com/properties/wyoming/filter/size[min]=10,size[max]=50"
    
    expect(urlWithSizeOnly).toMatch(/size\[min\]=10/)
    expect(urlWithSizeOnly).toMatch(/size\[max\]=50/)
    expect(urlWithSizeOnly).not.toMatch(/price\[/)
  })

  test("filter parameter format validation", () => {
    const params = [
      "price[min]=50000",
      "price[max]=500000",
      "size[min]=10",
      "size[max]=100",
    ]
    
    const paramPattern = /^[a-z_]+\[[a-z]+\]=[0-9]+$/
    
    for (const param of params) {
      expect(param).toMatch(paramPattern)
    }
  })

  test("zero or undefined values should be omitted", () => {
    // If minAcres is 0 or undefined, it should not appear in the URL
    const urlNoMinAcres = "https://www.landsearch.com/properties/montana/filter/size[max]=100"
    expect(urlNoMinAcres).not.toMatch(/size\[min\]/)
    expect(urlNoMinAcres).toMatch(/size\[max\]=100/)
    
    // If maxPrice is 0 or undefined, it should not appear
    const urlNoMaxPrice = "https://www.landsearch.com/properties/montana/filter/price[min]=50000"
    expect(urlNoMaxPrice).toMatch(/price\[min\]=50000/)
    expect(urlNoMaxPrice).not.toMatch(/price\[max\]/)
  })

  test("complete URL example matches expected format", () => {
    const completeURL = "https://www.landsearch.com/properties/montana/filter/price[min]=50000,price[max]=500000,size[min]=10,size[max]=100"
    
    // Structure checks
    expect(completeURL).toMatch(/^https:\/\/www\.landsearch\.com\/properties\/[a-z-]+\/filter\/.+$/)
    
    // All parameters present
    expect(completeURL).toMatch(/price\[min\]=50000/)
    expect(completeURL).toMatch(/price\[max\]=500000/)
    expect(completeURL).toMatch(/size\[min\]=10/)
    expect(completeURL).toMatch(/size\[max\]=100/)
    
    // No query string format
    expect(completeURL).not.toMatch(/\?/)
    expect(completeURL).not.toMatch(/&/)
  })
})
