export type RateLimiter = {
  wait(): Promise<void>
  reset(): void
  increaseDelay(): void
  decreaseDelay(): void
}

/**
 * Creates a random delay that simulates human behavior
 * @param baseMs - Base delay in milliseconds
 * @param variancePercent - Percentage variance (0-1), default 0.3 (30%)
 * @returns Random delay between baseMs * (1 - variance) and baseMs * (1 + variance)
 */
export function randomDelay(baseMs: number, variancePercent = 0.3): number {
  const variance = baseMs * variancePercent
  return baseMs + (Math.random() * 2 - 1) * variance
}

export type RateLimiterOptions = {
  minDelayMs?: number
  maxDelayMs?: number
  adaptiveStep?: number
}

export function createRateLimiter(
  initialDelayMs: number,
  options: RateLimiterOptions = {},
): RateLimiter {
  let lastCallTime = 0
  let currentDelay = initialDelayMs
  const minDelay = options.minDelayMs ?? initialDelayMs
  const maxDelay = options.maxDelayMs ?? initialDelayMs * 3
  const adaptiveStep = options.adaptiveStep ?? 1000

  return {
    async wait() {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallTime
      const timeToWait = Math.max(0, currentDelay - timeSinceLastCall)

      if (timeToWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, timeToWait))
      }

      lastCallTime = Date.now()
    },

    reset() {
      lastCallTime = 0
      currentDelay = initialDelayMs
    },

    increaseDelay() {
      currentDelay = Math.min(currentDelay + adaptiveStep, maxDelay)
    },

    decreaseDelay() {
      currentDelay = Math.max(currentDelay - adaptiveStep, minDelay)
    },
  }
}
