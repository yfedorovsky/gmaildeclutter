/**
 * Queue-based token bucket rate limiter with concurrency cap.
 * Safe for concurrent access — requests are serialized through a FIFO queue
 * so Promise.all() callers are properly throttled.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per ms
  private readonly maxConcurrent: number;
  private inFlight = 0;
  private queue: Array<{ cost: number; resolve: () => void }> = [];
  private draining = false;

  constructor(
    capacity: number = 250,
    refillRatePerSecond: number = 250,
    maxConcurrent: number = 10
  ) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = refillRatePerSecond / 1000;
    this.maxConcurrent = maxConcurrent;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  async acquire(cost: number = 1): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ cost, resolve });
      this.drain();
    });
  }

  /**
   * Call after request completes to free a concurrency slot.
   */
  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.drain();
  }

  /**
   * Penalize the rate limiter (e.g., on 429 response).
   * Drains tokens to force a cooldown period.
   */
  penalize(delayMs: number = 1000): void {
    this.tokens = Math.max(0, this.tokens - delayMs * this.refillRate);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    while (this.queue.length > 0) {
      this.refill();
      const next = this.queue[0];

      // Wait if at concurrency limit
      if (this.inFlight >= this.maxConcurrent) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      if (this.tokens >= next.cost) {
        this.tokens -= next.cost;
        this.inFlight++;
        this.queue.shift();
        next.resolve();
      } else {
        // Wait for enough tokens to refill
        const waitMs = (next.cost - this.tokens) / this.refillRate;
        await new Promise((r) => setTimeout(r, Math.ceil(waitMs)));
      }
    }

    this.draining = false;
  }
}

// Gmail API quota: 250 quota units/sec per user (15,000/min)
// messages.get = 5 units → ~50 fetches/sec at full throttle
// maxConcurrent: 10 prevents burst overload on Gmail API
export const gmailRateLimiter = new RateLimiter(250, 250, 10);
