/**
 * Queue-based token bucket rate limiter.
 * Safe for concurrent access — requests are serialized through a FIFO queue
 * so Promise.all() callers are properly throttled.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per ms
  private queue: Array<{ cost: number; resolve: () => void }> = [];
  private draining = false;

  constructor(capacity: number = 250, refillRatePerSecond: number = 250) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = refillRatePerSecond / 1000;
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

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    while (this.queue.length > 0) {
      this.refill();
      const next = this.queue[0];

      if (this.tokens >= next.cost) {
        this.tokens -= next.cost;
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
export const gmailRateLimiter = new RateLimiter(250, 250);
