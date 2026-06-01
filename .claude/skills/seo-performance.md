# Skill: SEO Performance & Core Web Vitals

## Purpose
Optimize page load speed and Core Web Vitals (LCP, CLS, INP) — the signals Google uses as ranking factors under Page Experience.

---

## Core Web Vitals targets

| Metric | Good | Needs Work | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5–4s | > 4s |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |
| INP (Interaction to Next Paint) | < 200ms | 200–500ms | > 500ms |

---

## LCP (largest content painted fast)

LCP is almost always the hero image or the `<h1>`. Optimize it directly.

### Preload the hero image
```html
<link rel="preload" as="image" href="assets/hero.jpg" fetchpriority="high">
```

### Mark hero image as high priority
```html
<img src="assets/hero.jpg" alt="..." fetchpriority="high" loading="eager">
```

### Lazy-load everything below the fold
```html
<img src="assets/below-fold.jpg" alt="..." loading="lazy">
```

Never `loading="lazy"` on the hero/LCP image — it delays it.

### Preconnect to third-party origins
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### Self-host fonts or use `font-display: swap`
```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
}
```

---

## CLS (no layout shifts)

CLS happens when images, embeds, or ads load without reserved space.

### Always set width and height on images
```html
<img src="assets/photo.jpg" alt="..." width="1200" height="800">
```
Even if CSS overrides the size, the browser uses these to reserve space before the image loads.

### Reserve space for async content
```css
.ad-slot {
  min-height: 250px; /* reserve expected height */
}
```

### Font CLS — use `font-display: swap` and size-adjust
```css
@font-face {
  font-family: 'WebFont';
  src: url('/fonts/webfont.woff2') format('woff2');
  font-display: swap;
  size-adjust: 100%; /* tweak to match fallback metrics */
  ascent-override: 90%;
}
```

---

## INP (fast interactions)

INP measures responsiveness. Main causes: heavy JS on the main thread, large event handlers.

- Break up long tasks with `setTimeout(() => {}, 0)` or `scheduler.postTask()`
- Debounce scroll/resize handlers
- Avoid synchronous layout reads inside event handlers (causes forced reflow)
- Use `content-visibility: auto` on off-screen sections to reduce render work

```js
// Debounce pattern
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
window.addEventListener('scroll', debounce(handleScroll, 100));
```

---

## Resource hints

```html
<!-- DNS lookup for third-party domains you'll connect to -->
<link rel="dns-prefetch" href="https://analytics.example.com">

<!-- Full connection (DNS + TCP + TLS) for critical third parties -->
<link rel="preconnect" href="https://fonts.googleapis.com">

<!-- Fetch critical resources before they're discovered in CSS/HTML -->
<link rel="preload" as="font" href="/fonts/main.woff2" type="font/woff2" crossorigin>
<link rel="preload" as="image" href="assets/hero.jpg">
<link rel="preload" as="script" href="main.js">
```

Order matters: preconnect and preload go near the top of `<head>`, before stylesheets.

---

## Image formats and sizing

- Use WebP for photos (30–50% smaller than JPEG at equivalent quality)
- Use SVG for logos, icons, and illustrations
- Serve appropriately sized images — don't serve 2400px images displayed at 600px

```html
<picture>
  <source srcset="assets/hero.webp" type="image/webp">
  <img src="assets/hero.jpg" alt="..." width="1200" height="800"
       loading="eager" fetchpriority="high">
</picture>
```

For responsive images:
```html
<img
  src="assets/hero-800.jpg"
  srcset="assets/hero-400.jpg 400w, assets/hero-800.jpg 800w, assets/hero-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px"
  alt="..."
  width="1200" height="800">
```

---

## Script loading

```html
<!-- Defer non-critical scripts — executes after HTML parsed -->
<script defer src="main.js"></script>

<!-- Async for independent scripts (analytics) — executes as soon as loaded -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"></script>

<!-- Never block rendering with scripts in <head> without async/defer -->
```

Rule: the only scripts that should block rendering are those needed for above-the-fold rendering (rare). Everything else gets `defer` or `async`.

---

## Measurement

- **Google PageSpeed Insights:** https://pagespeed.web.dev
- **Chrome DevTools:** Lighthouse tab → run for Mobile
- **WebPageTest:** https://www.webpagetest.org
- **Google Search Console:** Core Web Vitals report (real user data)
