# Skill: SEO Meta Tags

## Purpose
Audit and implement all head-level SEO meta tags for any HTML page. Covers the full set: title, description, canonical, Open Graph, Twitter Card, robots, author, and geo tags.

## Checklist

### Required on every page
- `<title>` — primary keyword first, brand name last, pipe-separated. 50–60 chars. Example: `Primary Keyword — Page Name | Brand`
- `<meta name="description">` — 140–160 chars, includes primary keyword, reads naturally, no keyword stuffing
- `<link rel="canonical">` — absolute URL, no trailing slash inconsistency, matches the URL Google should index
- `<meta name="robots" content="index, follow">` — or `noindex, nofollow` for private/staging pages

### Open Graph (social sharing)
All five core tags must be present and match the title/description exactly:
```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/page">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://example.com/assets/og-image.jpg">
```
Also include:
- `og:image:width` — at minimum, so crawlers don't have to fetch to size it (1200px recommended)
- `og:image:alt` — describe the image, not the brand
- `og:site_name` — brand name
- `og:locale` — e.g. `en_US`, `en_CA`, `fr_FR`

### Twitter Card
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="...">
```
Use `summary_large_image` for hero images. Use `summary` for icon-only branding.

### Author and geo (when applicable)
```html
<meta name="author" content="Brand Name">
<!-- For location-based businesses: -->
<meta name="geo.region" content="US-CA">
<meta name="geo.placename" content="City Name">
<meta name="geo.position" content="LAT;LONG">
<meta name="ICBM" content="LAT, LONG">
```

### Favicon suite
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="shortcut icon" type="image/png" href="/assets/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon.png">
```

## Title formula by page type
- Homepage: `[Primary Keyword] | [Brand Name]`
- Interior page: `[Page Topic] — [Brand Name]`
- Blog post: `[Post Title] | [Brand Name]`
- Landing page: `[Hook/Offer] | [Brand Name]`

Avoid: duplicate titles across pages, vague titles ("Home", "About"), titles over 60 chars.

## Common mistakes to fix
- `og:url` doesn't match `<link rel="canonical">` — they must match
- `og:image` is a relative path — must be absolute
- Description is over 160 chars — gets truncated in SERPs
- Missing `og:locale` on multilingual or region-specific sites
- `<title>` ends with brand name on every page but homepage — flip it: keyword first
