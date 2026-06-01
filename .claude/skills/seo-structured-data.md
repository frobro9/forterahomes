# Skill: Structured Data (JSON-LD / Schema.org)

## Purpose
Implement schema.org structured data as JSON-LD to improve rich results in Google Search. Covers the most common entity types and the `@graph` pattern for linking them.

## Core pattern — always use `@graph`

Use `@graph` with `@id` anchors so entities can cross-reference each other. Place the script in `<head>`.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Brand Name",
      "url": "https://example.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/assets/logo.svg"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "Site Name",
      "publisher": { "@id": "https://example.com/#organization" }
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/page/#webpage",
      "url": "https://example.com/page/",
      "name": "Page Title",
      "isPartOf": { "@id": "https://example.com/#website" }
    }
  ]
}
</script>
```

## Entity types by use case

### Local business
```json
{
  "@type": "LocalBusiness",
  "@id": "https://example.com/#business",
  "name": "Business Name",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "ST",
    "postalCode": "12345",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 0.0000,
    "longitude": 0.0000
  },
  "telephone": "+1-555-000-0000",
  "openingHoursSpecification": []
}
```

### Real estate / apartment complex
```json
{
  "@type": "ApartmentComplex",
  "@id": "https://example.com/#listing",
  "name": "Development Name",
  "description": "...",
  "url": "https://example.com",
  "image": "https://example.com/assets/hero.jpg",
  "numberOfRooms": 0,
  "address": { "@type": "PostalAddress", "..." : "..." },
  "geo": { "@type": "GeoCoordinates", "latitude": 0.0, "longitude": 0.0 },
  "offers": {
    "@type": "Offer",
    "businessFunction": "https://purl.org/goodrelations/v1#LeaseOut",
    "availability": "https://schema.org/InStock",
    "seller": { "@id": "https://example.com/#organization" }
  }
}
```
Use `availability: PreOrder` before the property is available.

### Blog post / article
```json
{
  "@type": "Article",
  "@id": "https://example.com/blog/post-slug/#article",
  "headline": "Post Title",
  "description": "...",
  "datePublished": "2026-01-01",
  "dateModified": "2026-01-15",
  "author": { "@id": "https://example.com/#organization" },
  "publisher": { "@id": "https://example.com/#organization" },
  "image": "https://example.com/assets/post-image.jpg",
  "mainEntityOfPage": { "@id": "https://example.com/blog/post-slug/#webpage" }
}
```

### FAQ
```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text."
      }
    }
  ]
}
```

### BreadcrumbList (for interior pages)
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://example.com/blog/" },
    { "@type": "ListItem", "position": 3, "name": "Post Title" }
  ]
}
```

## Validation
- Test with Google's Rich Results Test: https://search.google.com/test/rich-results
- Test with Schema.org validator: https://validator.schema.org
- All `@id` values must be absolute URLs, unique per entity, and consistent across pages

## Common mistakes
- Relative URLs in `@id`, `url`, or `image` — must all be absolute
- Duplicating `Organization` and `WebSite` on every page without `@id` anchors — use `@id` so they're recognized as the same entity across pages
- `datePublished` / `dateModified` not in ISO 8601 format (`YYYY-MM-DD`)
- Missing `mainEntityOfPage` link on Article — this is how Google connects the article to the WebPage
