import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const delays = [30, 10, 20, 5, 25];
    const result = await mapWithConcurrency(delays, 3, async (delay, i) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("never runs more than `concurrency` calls at once", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return item;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("processes every item exactly once", async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const seen: number[] = [];

    await mapWithConcurrency(items, 4, async (item) => {
      seen.push(item);
      return item;
    });

    expect(seen.slice().sort((a, b) => a - b)).toEqual(items);
  });

  it("handles an empty input array", async () => {
    const result = await mapWithConcurrency([], 5, async (x) => x);
    expect(result).toEqual([]);
  });

  it("works fine when concurrency exceeds the item count", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (x) => x * 2);
    expect(result).toEqual([2, 4]);
  });

  it("propagates a rejection from fn", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      })
    ).rejects.toThrow("boom");
  });
});
