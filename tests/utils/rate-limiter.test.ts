import { test, expect } from "bun:test"
import { createRateLimiter } from "../../src/utils/rate-limiter"

test("rate limiter enforces minimum delay between calls", async () => {
  const limiter = createRateLimiter(100)

  const start = Date.now()

  await limiter.wait()
  const time1 = Date.now() - start

  await limiter.wait()
  const time2 = Date.now() - start

  await limiter.wait()
  const time3 = Date.now() - start

  expect(time1).toBeLessThan(50)
  expect(time2).toBeGreaterThanOrEqual(100)
  expect(time3).toBeGreaterThanOrEqual(200)
})

test("rate limiter reset clears timing", async () => {
  const limiter = createRateLimiter(100)

  await limiter.wait()
  await limiter.wait()

  limiter.reset()

  const start = Date.now()
  await limiter.wait()
  const elapsed = Date.now() - start

  expect(elapsed).toBeLessThan(50)
})
