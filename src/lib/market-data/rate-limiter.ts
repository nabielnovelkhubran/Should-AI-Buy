// ---------------------------------------------------------------------------
// Phase 8.20: Rate-Limit Resilient Market Data Request Controller
// INVARIANT: Controlled request concurrency, token pacing, deduplication,
// and short-lived caching to prevent Alpaca HTTP 429 throttling.
// INVARIANT: Never exposes raw credentials in logs, errors, or telemetry.
// ---------------------------------------------------------------------------

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface RequestQueueOptions {
  maxConcurrency?: number;
  minIntervalMs?: number;
  defaultTtlMs?: number;
  maxRetries?: number;
}

export interface PartialDiscoveryReport {
  requestedCount: number;
  receivedCount: number;
  failedCount: number;
  failedSymbols: string[];
  reason: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'PARTIAL_DATA' | 'NONE';
  timestamp: string;
}

export class MarketDataRateLimiter {
  private inFlightQueue: Array<() => Promise<void>> = [];
  private activeCount: number = 0;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly defaultTtlMs: number;
  private readonly maxRetries: number;
  private lastRequestTime: number = 0;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingPromises: Map<string, Promise<any>> = new Map();
  private rateLimitResetTime: number = 0;

  constructor(options?: RequestQueueOptions) {
    this.maxConcurrency = options?.maxConcurrency ?? 3;
    this.minIntervalMs = options?.minIntervalMs ?? 60; // Max ~1000 req/min theoretically, pace at 60ms
    this.defaultTtlMs = options?.defaultTtlMs ?? 30000; // 30s cache
    this.maxRetries = options?.maxRetries ?? 2;
  }

  /**
   * Executes a market data fetch function with concurrency control, deduplication,
   * caching, and exponential backoff retry on HTTP 429.
   */
  public async execute<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const now = Date.now();

    // 1. Check in-memory cache
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    // 2. Check in-flight promise deduplication
    const existingPromise = this.pendingPromises.get(key);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }

    // 3. Create execution promise
    const taskPromise = this.enqueueTask(async () => {
      let attempt = 0;
      let lastError: any = null;

      while (attempt <= this.maxRetries) {
        // Respect known rate limit reset time
        const waitReset = this.rateLimitResetTime - Date.now();
        if (waitReset > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(waitReset, 30000)));
        }

        try {
          const result = await fetchFn();
          // Store in cache upon success
          this.cache.set(key, {
            data: result,
            expiresAt: Date.now() + effectiveTtl
          });
          return result;
        } catch (err: any) {
          lastError = err;
          const is429 = err?.statusCode === 429 || err?.message?.includes('429') || err?.message?.includes('rate limit');

          if (is429) {
            // Parse reset header or use exponential backoff
            const resetHeader = err?.rateLimitReset;
            let backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            if (resetHeader) {
              const resetSec = parseInt(resetHeader, 10);
              if (!isNaN(resetSec)) {
                const deltaMs = (resetSec * 1000) - Date.now();
                if (deltaMs > 0 && deltaMs < 60000) {
                  backoffMs = deltaMs;
                }
              }
            }

            this.rateLimitResetTime = Date.now() + backoffMs;
            if (attempt < this.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              attempt++;
              continue;
            }
          }
          throw lastError;
        }
      }

      throw lastError;
    });

    this.pendingPromises.set(key, taskPromise);

    try {
      return await taskPromise;
    } finally {
      this.pendingPromises.delete(key);
    }
  }

  private enqueueTask<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const executeTask = async () => {
        this.activeCount++;
        try {
          // Pace requests by minimum interval
          const now = Date.now();
          const elapsed = now - this.lastRequestTime;
          if (elapsed < this.minIntervalMs) {
            await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed));
          }
          this.lastRequestTime = Date.now();

          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.processNext();
        }
      };

      this.inFlightQueue.push(executeTask);
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.maxConcurrency || this.inFlightQueue.length === 0) {
      return;
    }
    const nextTask = this.inFlightQueue.shift();
    if (nextTask) {
      nextTask();
    }
  }

  public clearCache(): void {
    this.cache.clear();
    this.pendingPromises.clear();
  }

  public getCacheStats(): { size: number; activeRequests: number; queuedRequests: number } {
    return {
      size: this.cache.size,
      activeRequests: this.activeCount,
      queuedRequests: this.inFlightQueue.length
    };
  }
}

export const marketDataRateLimiter = new MarketDataRateLimiter();
