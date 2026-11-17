/**
 * In-Flight Request Deduplicator (Criterion 12: Request Deduplication)
 * Coalesces multiple identical concurrent async calls into a single network execution.
 */
class RequestDeduplicator {
  private inFlight = new Map<string, Promise<unknown>>();

  /**
   * Executes or shares an in-flight Promise for the given key.
   */
  async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await requestFn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise as Promise<unknown>);
    return promise;
  }
}

export const requestDeduplicator = new RequestDeduplicator();
