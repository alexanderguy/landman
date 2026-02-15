# LandWatch.com API Investigation Findings

## Executive Summary

LandWatch.com uses a POST API endpoint to fetch property search results. The API is called during initial page load and accepts a JSON payload with comprehensive filter parameters.

---

## 1. API Timing & Triggers

### When the API Call Happens

- **Timing**: The API call happens **immediately on page load** (within ~100ms)
- **Sequence**: 
  1. Page navigation begins
  2. Authentication check (`/api/authenticate/isloggedin`)
  3. **Search API called** (`POST /api/property/searchUrl/1113`)
  4. Popular search logged (`POST /api/Popular/logPopularSearch/1113`)
  5. Login info fetched (`/api/authenticate/logininfo/1113`)

- **JavaScript initialization**: The API is called after the React app initializes on the client side
- **Trigger**: Automatic on page mount - the React component makes the API call based on the URL pathname

### Key Observation
The page doesn't wait for the API response to complete before the timeout occurred, suggesting this is a client-side rendered React application that makes API calls after hydration.

---

## 2. API Endpoint Details

### Endpoint Format
```
POST https://www.landwatch.com/api/property/searchUrl/{stateId}
```

### Confirmed State ID
- **Montana**: `1113` (NOT 30 as previously assumed!)
- The `1113` appears to be an internal LandWatch state identifier
- The payload also includes `stateId: 30` which IS the standard state code

### Request Headers
```json
{
  "accept": "text/plain",
  "content-type": "application/json",
  "sec-ch-ua-platform": "\"macOS\"",
  "user-agent": "Mozilla/5.0..."
}
```

---

## 3. Request Payload Structure

### Complete Payload Schema
```json
{
  "acresMax": null,
  "acresMin": null,
  "activityTypes": [],
  "amenityTypes": [],
  "bathMax": null,
  "bathMin": null,
  "bedMax": null,
  "bedMin": null,
  "cityIdList": [],
  "cityName": "",
  "countyIdList": [],
  "countyName": "",
  "customSearchUrl": "",
  "dateListed": 0,
  "hasCustomMap": false,
  "hasHouse": null,
  "hasVideo": false,
  "hasVirtualTour": false,
  "inventoryIdList": [],
  "isDefaultGeoSearch": true,
  "isDefaultStateAndTypeSearch": false,
  "isDefaultStateSearch": true,
  "isNearMeSearch": false,
  "isSellerSearchPage": false,
  "keywordQuery": null,
  "lakeIdList": [],
  "latitude": null,
  "longitude": null,
  "marketStatuses": [1, 2],
  "mineralRights": false,
  "ownerFinancing": false,
  "pageIndex": 0,
  "priceMax": null,
  "priceMin": null,
  "priceChangeLookback": 0,
  "priceChangeType": 0,
  "propertyTypes": [],
  "radius": 0,
  "regionIdList": [],
  "regionName": "",
  "sortOrderId": 0,
  "sqftMax": null,
  "sqftMin": null,
  "stateAbbreviation": "MT",
  "stateId": 30,
  "stateName": "Montana",
  "transactionTypes": [],
  "zip": "",
  "userSavedProperties": false,
  "brokerId": 0,
  "mapEncodedCords": "",
  "tempSkipNavigation": false
}
```

### Key Filter Fields
- `priceMin`, `priceMax` - Price range filters
- `acresMin`, `acresMax` - Acreage range filters
- `marketStatuses` - Array: `[1, 2]` = Available & Under Contract
- `pageIndex` - Zero-based pagination (0 = first page)
- `sortOrderId` - Sort order (0 = default)
- `stateId` - Standard state code (30 = Montana)
- `stateAbbreviation` - Two-letter code ("MT")

---

## 4. Response Format

### Response Details
- **Content-Type**: `text/plain; charset=utf-8`
- **Encoding**: Brotli compressed (`br`)
- **Cache Control**: `public, max-age=217` (cached for ~3.6 minutes)
- **Response Size**: 26 bytes compressed (indicating very small response)

### ⚠️ Response Body Issue
The response body was NOT captured in our investigation because the page timed out before the response could be fully read. However, based on the content-type and the way the page works:

**HYPOTHESIS**: The API likely returns:
- **Option A**: A URL/path string that the frontend then uses to fetch HTML
- **Option B**: A minimal JSON response with pagination info
- **Option C**: The full property list as JSON

Given the `text/plain` content-type and small size (26 bytes), it's most likely returning a **search result URL or identifier**, not the actual property data.

---

## 5. State ID Mapping

### Critical Discovery
The URL uses `1113` as the state identifier, but the payload includes `stateId: 30`.

This suggests:
- **URL parameter** (`1113`) = LandWatch's internal search configuration ID
- **Payload `stateId`** (`30`) = Standard FIPS state code

### To Find State IDs
You need to map each state by:
1. Navigate to `https://www.landwatch.com/{state}-land-for-sale`
2. Capture the POST request to `/api/property/searchUrl/{ID}`
3. The `{ID}` in the URL is the state-specific search ID

### Known Mappings
- Montana: `1113` (URL) + `30` (payload stateId)

---

## 6. Testing the API Directly

### Can We Call It Directly?
**Likely YES**, but with caveats:

1. **Request is valid**: The POST payload structure is clear and well-defined
2. **No auth required**: The API works for non-logged-in users
3. **CORS**: The API is same-origin, so direct browser fetch will work
4. **Brotli compression**: The response uses Brotli - need proper decompression
5. **Cache headers**: Aggressive caching means repeated requests may hit CDN cache

### Testing Approach
```javascript
// In browser console on landwatch.com
const response = await fetch('https://www.landwatch.com/api/property/searchUrl/1113', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/plain'
  },
  body: JSON.stringify({
    acresMax: 100,
    acresMin: 10,
    priceMax: 500000,
    priceMin: 50000,
    pageIndex: 0,
    stateId: 30,
    stateAbbreviation: "MT",
    stateName: "Montana",
    marketStatuses: [1, 2],
    // ... all other required fields
  })
});

const result = await response.text();
console.log(result);
```

---

## 7. Playwright Integration Approaches

### Option A: Intercept & Modify (RECOMMENDED)
**Current implementation uses this approach**

```typescript
await page.route('**/api/property/searchUrl/**', async (route) => {
  const request = route.request()
  if (request.method() === 'POST') {
    const postData = request.postDataJSON() || {}
    const modifiedData = {
      ...postData,
      priceMin: 50000,
      priceMax: 500000,
      acresMin: 10,
      acresMax: 100,
    }
    await route.continue({ postData: JSON.stringify(modifiedData) })
  } else {
    await route.continue()
  }
})
```

**Pros**:
- Works exactly like the real site
- Handles all edge cases (auth, cookies, etc.)
- Gets the actual rendered HTML with properties
- Bot detection avoidance (looks like normal browsing)

**Cons**:
- Still need to scrape HTML
- Slower than direct API calls
- Browser overhead

### Option B: Direct API Request
```typescript
const apiResponse = await page.request.post(
  'https://www.landwatch.com/api/property/searchUrl/1113',
  {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/plain'
    },
    data: {
      priceMin: 50000,
      priceMax: 500000,
      acresMin: 10,
      acresMax: 100,
      stateId: 30,
      stateAbbreviation: "MT",
      // ... full payload
    }
  }
)
```

**Pros**:
- Faster (no page rendering)
- Less resource intensive
- Cleaner code

**Cons**:
- **Unknown response format** - we don't know what it returns yet
- May require additional API calls to get property data
- Might trigger bot detection
- Need to handle cookies/sessions manually

### Option C: Hybrid Approach (BEST LONG-TERM)
1. Navigate to base Montana page once
2. Let React app initialize (establishes cookies/session)
3. Use `page.evaluate()` to call the API with custom filters
4. Extract response data directly from the JavaScript context

```typescript
const properties = await page.evaluate(async (filters) => {
  const response = await fetch('/api/property/searchUrl/1113', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  })
  return await response.json() // or .text()
}, {
  priceMin: 50000,
  priceMax: 500000,
  // ... filters
})
```

**Pros**:
- Uses the page's existing auth/cookies
- Bypasses bot detection (runs in legitimate browser context)
- Fast (no re-navigation)
- Can directly access the response

**Cons**:
- Still requires initial page load
- Need to know the response format

### Option D: Wait & Scrape (CURRENT FALLBACK)
Just navigate with URL params and scrape the rendered HTML.

**Pros**:
- Simple, reliable
- Proven to work

**Cons**:
- Slowest method
- Most resource intensive

---

## 8. Critical Next Steps

### Immediate Actions Required

1. **Discover Response Format**
   - Modify the investigation script to capture the full response body
   - Use longer timeout or wait for specific network events
   - Alternative: Use browser DevTools manually to see the response

2. **Map All State IDs**
   - Create script to visit each state page
   - Capture the search URL ID for all 50 states
   - Build a comprehensive state ID mapping

3. **Test Filter Variations**
   - Confirm priceMin/priceMax work as expected
   - Test acresMin/acresMax
   - Verify pagination with pageIndex
   - Test sorting with sortOrderId

4. **Understand Response Flow**
   - Does the API return HTML or JSON?
   - If URL/ID, what's the next request to get properties?
   - Are properties in JSON-LD schema on rendered page?

---

## 9. Recommended Implementation Path

### Phase 1: Investigation (NOW)
- [ ] Capture full API response body
- [ ] Determine response format (HTML/JSON/URL)
- [ ] Test direct API call with filters
- [ ] Verify filters actually work

### Phase 2: State Mapping
- [ ] Build state ID discovery script
- [ ] Map all 50 states (or at least top 10 target states)
- [ ] Create `STATE_ID_MAP` constant

### Phase 3: Plugin Rewrite
Choose one of these approaches:

**If API returns JSON with properties:**
```typescript
async function* search(criteria, callbacks) {
  // Load page once to establish session
  await page.goto(baseUrl)
  
  // Use page.evaluate to call API directly
  const results = await page.evaluate(async (filters) => {
    const response = await fetch('/api/property/searchUrl/1113', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    })
    return await response.json()
  }, buildFilterPayload(criteria))
  
  // Yield normalized properties
  for (const property of results) {
    yield normalizeProperty(property)
  }
}
```

**If API returns URL/ID:**
```typescript
// Keep current approach but optimize:
// - Only intercept, don't navigate multiple times
// - Use single page load with modified API payload
// - Scrape rendered results
```

### Phase 4: Testing
- [ ] Test with Montana
- [ ] Verify deduplication still works
- [ ] Check pagination
- [ ] Validate filter accuracy

---

## 10. Key Findings Summary

| Question | Answer |
|----------|--------|
| **When does API call happen?** | Immediately on page load (~100ms), triggered by React app |
| **What triggers it?** | Automatic on component mount, based on URL pathname |
| **Response format?** | ⚠️ Unknown - need to capture full response |
| **Returns HTML or JSON?** | ⚠️ Unknown - likely URL/ID or JSON |
| **State ID for Montana** | `1113` (URL parameter) + `30` (payload stateId) |
| **Can we call API directly?** | Likely yes, but response format unknown |
| **Best integration approach?** | Hybrid: page load + page.evaluate() for API calls |
| **Do filters work via API?** | ⚠️ Need to test - payload structure exists |

---

## 11. Code Examples

### Building the Complete Payload
```typescript
function buildSearchPayload(criteria: SearchCriteria, state: string): any {
  const priceRange = getPriceForState(criteria, state)
  
  return {
    acresMax: criteria.maxAcres ?? null,
    acresMin: criteria.minAcres ?? null,
    activityTypes: [],
    amenityTypes: [],
    bathMax: null,
    bathMin: null,
    bedMax: null,
    bedMin: null,
    cityIdList: [],
    cityName: "",
    countyIdList: [],
    countyName: "",
    customSearchUrl: "",
    dateListed: 0,
    hasCustomMap: false,
    hasHouse: null,
    hasVideo: false,
    hasVirtualTour: false,
    inventoryIdList: [],
    isDefaultGeoSearch: true,
    isDefaultStateAndTypeSearch: false,
    isDefaultStateSearch: true,
    isNearMeSearch: false,
    isSellerSearchPage: false,
    keywordQuery: null,
    lakeIdList: [],
    latitude: null,
    longitude: null,
    marketStatuses: [1, 2], // Available & Under Contract
    mineralRights: false,
    ownerFinancing: false,
    pageIndex: 0,
    priceMax: priceRange.max ?? null,
    priceMin: priceRange.min ?? null,
    priceChangeLookback: 0,
    priceChangeType: 0,
    propertyTypes: [],
    radius: 0,
    regionIdList: [],
    regionName: "",
    sortOrderId: 0,
    sqftMax: null,
    sqftMin: null,
    stateAbbreviation: state,
    stateId: STATE_FIPS_CODES[state], // e.g., 30 for MT
    stateName: STATE_NAMES[state], // e.g., "Montana"
    transactionTypes: [],
    zip: "",
    userSavedProperties: false,
    brokerId: 0,
    mapEncodedCords: "",
    tempSkipNavigation: false
  }
}
```

### State ID Discovery Script
```typescript
async function discoverStateId(stateAbbr: string): Promise<number> {
  const page = await browser.newPage()
  
  let stateId: number | null = null
  
  page.on('request', (request) => {
    const url = request.url()
    const match = url.match(/\/api\/property\/searchUrl\/(\d+)/)
    if (match) {
      stateId = parseInt(match[1])
    }
  })
  
  await page.goto(`https://www.landwatch.com/${stateAbbr.toLowerCase()}-land-for-sale`)
  await page.waitForTimeout(3000)
  await page.close()
  
  return stateId!
}
```

---

## Conclusion

The LandWatch API is accessible and well-structured. The main unknowns are:

1. **Response format** - Need to capture the actual response
2. **Full state ID mapping** - Need to discover IDs for all states
3. **Filter validation** - Need to confirm filters work as expected

**Next immediate step**: Modify the investigation script to successfully capture the API response body by using a longer timeout or better network event waiting.
