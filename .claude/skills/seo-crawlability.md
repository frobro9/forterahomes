# Skill: SEO Crawlability — robots.txt, sitemap.xml, llms.txt

## Purpose
Set up and maintain the files that control how search engines and AI crawlers discover, index, and understand a site.

---

## robots.txt

### Standard permissive setup (most sites)
```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

### Block specific paths
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /staging/

Sitemap: https://example.com/sitemap.xml
```

### Block AI training crawlers (optional, increasingly common)
```
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

**Rules:**
- Must be at the root: `https://example.com/robots.txt`
- `Sitemap:` line must be an absolute URL
- One `User-agent` block per agent, or use `*` for all
- `Disallow: /` blocks everything; `Disallow:` (empty) allows everything

---

## sitemap.xml

### Basic structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>

</urlset>
```

### Priority guide
| Page type | Priority |
|---|---|
| Homepage | 1.0 |
| Key landing pages | 0.9 |
| Important interior pages | 0.8 |
| Blog index, category pages | 0.8 |
| Standard interior pages | 0.7 |
| Blog posts | 0.6–0.7 |
| Tag/archive pages | 0.4–0.5 |

### changefreq guide
| Content type | changefreq |
|---|---|
| News, live updates | `daily` |
| Blog, frequently updated | `weekly` |
| Landing pages, about, product | `monthly` |
| Legal, evergreen | `yearly` |

**Rules:**
- `<loc>` must be absolute URLs
- `<lastmod>` in `YYYY-MM-DD` format
- Exclude: 404 pages, redirects, noindex pages, duplicate URLs
- For large sites (>50k URLs) use a sitemap index file
- Reference in `robots.txt` with the absolute URL
- Submit to Google Search Console after creating or updating

### Sitemap index (large sites)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
    <lastmod>2026-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2026-01-01</lastmod>
  </sitemap>
</sitemapindex>
```

---

## llms.txt

`llms.txt` is a plain-text file at the root that tells AI systems and LLMs what the site is, what it offers, and where to find key content. It's the AI equivalent of a well-structured README.

Place at: `https://example.com/llms.txt`

### Template
```
# Brand Name — [One-line description]

> [2–3 sentence summary of what the business/site is and does]

## About

- **Founded:** YYYY
- **Location:** City, Region
- **Mission:** [One sentence]
- **Primary offering:** [Product/service description]

## Key Pages

- **Homepage:** https://example.com/
- **[Section]:** https://example.com/section
- **[Section]:** https://example.com/section
- **Contact / Register:** https://example.com/contact

## Products / Services

- [Item]: [Brief description]
- [Item]: [Brief description]

## Contact

- Email: hello@example.com
- Phone: +1-555-000-0000
- Address: 123 Main St, City, ST

## Sitemap

https://example.com/sitemap.xml
```

**Guidelines:**
- Keep it factual — no marketing fluff
- Include structured facts (lists, key-value pairs) over paragraphs
- Update when URLs change or new sections are added
- Do not include confidential or internal information
