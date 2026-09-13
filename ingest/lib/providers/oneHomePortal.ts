import * as cheerio from "cheerio";
import { SpecSheetListing } from "./specSheetParser";
import { extractListingFromText } from "./oneHomeExtractor";

const NAV_DELAY_MS = 1000;

/**
 * A realtor's OneHome/TRREB client-portal notification email doesn't carry
 * listing data itself — it's a link to a JS-rendered app. This finds that
 * link in the email's HTML body.
 */
export function extractOneHomeLink(html: string): string | null {
  const $ = cheerio.load(html);
  const link = $("a[href*='portal.onehome.com']").attr("href");
  return link ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stable per-listing identifier from a OneHome property detail URL's path
 * (e.g. "aotf~1183078787~TRREB" from
 * ".../property/aotf~1183078787~TRREB?token=...&searchId=..."). The query
 * string (token, searchId) is per-email/session metadata that differs even
 * for the exact same underlying listing, so it can't be used to recognize
 * "the same property, seen again" — the path segment is what actually
 * identifies the listing in OneHome's system, and is what
 * OneHomePortalSpecSheetParser dedupes on (see specSheetParser.ts).
 */
export function extractOneHomePropertyKey(detailUrl: string): string {
  const { pathname } = new URL(detailUrl);
  return pathname.split("/").pop() || detailUrl;
}

/**
 * Renders the OneHome search-results page for a saved-search link and
 * returns the absolute detail-page URL for every listing it lists. Split
 * out from the actual scrape+extract below so a caller merging several
 * saved-search links (e.g. one per matching email) can dedupe the combined
 * URL set — by extractOneHomePropertyKey — before paying for the expensive
 * part on a property already covered by an earlier link.
 *
 * `playwright` is dynamically imported (rather than a static top-level
 * import) so that pages/routes which never actually scrape (the
 * dashboard reading already-persisted data) don't drag a full browser
 * binary into their module graph — Vercel's standard serverless runtime
 * can't load it at all, and this function is only ever meant to run in
 * the GitHub Actions ingest job, which does have a real Chromium
 * installed (see .github/workflows/ingest.yml).
 */
export async function discoverOneHomeListingUrls(portalUrl: string): Promise<string[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(portalUrl, { waitUntil: "networkidle" });

    // The results page paginates via an explicit "LOAD MORE" button, not
    // infinite scroll — confirmed directly against a live saved search:
    // scrolling to the bottom never grew the link count past the initial
    // ~24-listing batch, but clicking the button did (24 -> 48). A saved
    // search with ~180 active listings needs this clicked repeatedly, or
    // everything past the first batch is silently missing with no error.
    const loadMoreButton = page.getByRole("button", { name: "LOAD MORE" });
    const MAX_CLICKS = 30; // generous ceiling — a real saved search rarely exceeds a few hundred results
    for (let i = 0; i < MAX_CLICKS; i++) {
      if (!(await loadMoreButton.isVisible().catch(() => false))) break;
      const beforeCount = await page.locator("a[href*='/property/']").count();
      await loadMoreButton.click();
      // Wait for the new batch to actually render rather than assuming a
      // fixed delay is enough — under CI's slower/more variable network,
      // a fixed 750ms wait sometimes fired before the next batch finished
      // rendering, making a still-loading page look identical to "nothing
      // more to load" and cutting pagination short. Confirmed against a
      // live saved search: this silently truncated results at a different
      // (wrong) count every run instead of reaching the full list, which
      // meant listings added past that point were never discovered.
      const grew = await page
        .waitForFunction(
          (before) => document.querySelectorAll("a[href*='/property/']").length > before,
          beforeCount,
          { timeout: 10000 }
        )
        .then(() => true)
        .catch(() => false);
      // A click that never added anything within the timeout means
      // there's nothing more to load (or the button stopped responding)
      // — stop rather than clicking indefinitely.
      if (!grew) break;
    }

    const hrefs = await page.locator("a[href*='/property/']").evaluateAll((links) =>
      links.map((el) => (el as HTMLAnchorElement).getAttribute("href")).filter((href): href is string => !!href)
    );
    const uniqueHrefs = [...new Set(hrefs)];
    console.log(`[oneHomePortal] Discovered ${uniqueHrefs.length} unique listing link(s) at ${portalUrl}`);

    // A saved search can legitimately have zero currently-active matches
    // (e.g. everything that matched it previously has since sold or been
    // relisted outside the criteria) — that's not a scrape failure, so it
    // must not throw. It used to, which meant one such link anywhere in a
    // day's batch of emails aborted the entire ingest run and discarded
    // every listing already scraped from other emails that same run.
    return uniqueHrefs.map((href) => new URL(href, portalUrl).toString());
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes each given (already-resolved, already-deduped) OneHome property
 * detail page — one browser, one page, one navigation at a time, the same
 * polite-sequential discipline used elsewhere in this provider for
 * geocoding — and hands its rendered text to Claude
 * (lib/providers/oneHomeExtractor.ts) for field extraction instead of
 * hand-written regexes, since OneHome's layout varies across property
 * types. A single bad/unusual listing page is logged and skipped rather
 * than aborting the whole batch.
 */
export async function scrapeOneHomeListings(detailUrls: string[]): Promise<SpecSheetListing[]> {
  if (detailUrls.length === 0) return [];

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const listings: SpecSheetListing[] = [];

  try {
    const page = await browser.newPage();
    for (const detailUrl of detailUrls) {
      try {
        await page.goto(detailUrl, { waitUntil: "networkidle" });
        await page.getByRole("tabpanel").getByRole("button", { name: "Property Details" }).click();
        await page.waitForTimeout(500);

        const bodyText = (await page.locator("main").innerText()) || (await page.innerText("body"));
        const listing = await extractListingFromText(bodyText, detailUrl);
        listings.push(listing);
      } catch (err) {
        console.warn(`[oneHomePortal] Skipping listing at ${detailUrl}: ${(err as Error).message}`);
      }
      await sleep(NAV_DELAY_MS);
    }

    return listings;
  } finally {
    await browser.close();
  }
}
