/**
 * Runs `fn` over `items`, keeping at most `concurrency` calls in flight at
 * once, instead of an unthrottled Promise.all — a batch of listings that
 * each fire a few outbound requests (e.g. the City of Ottawa's live GIS
 * layers in lib/zoning/gisMatch.ts) can otherwise send hundreds of
 * concurrent requests to the same free public service and overwhelm it,
 * silently degrading its responses rather than erroring outright. Order
 * of results matches the order of items regardless of completion order.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
