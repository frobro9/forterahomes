# Skill: HTML Page Structure

## Purpose
Implement correct semantic HTML structure for any web page — heading hierarchy, landmark regions, section organization, nav, footer, and document outline.

---

## Document skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- SEO meta tags here -->
  <title>Page Title | Brand</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

  <nav>...</nav>

  <main>
    <section>...</section>
    <section>...</section>
  </main>

  <footer>...</footer>

  <!-- Dialogs/overlays go after </main>, before </body> -->
  <div role="dialog" aria-modal="true">...</div>

  <script src="main.js"></script>
</body>
</html>
```

---

## Heading hierarchy

One `<h1>` per page. It should contain the primary keyword and describe what the page is about. Every subsequent heading level must be nested correctly — never skip levels.

```
h1  — Page's primary topic (one only)
  h2  — Major section
    h3  — Subsection
      h4  — Sub-subsection (rarely needed)
```

**Correct:**
```html
<h1>Luxury Rentals in Ottawa</h1>
<h2>Available Floor Plans</h2>
<h3>2 Bedroom Suites</h3>
<h3>3 Bedroom Suites</h3>
<h2>The Neighbourhood</h2>
```

**Wrong:**
```html
<h1>Brand Name</h1>   <!-- h1 shouldn't be the logo/brand -->
<h3>Floor Plans</h3>  <!-- skipped h2 -->
<h2>Suites</h2>       <!-- went back up after h3 — confusing outline -->
```

The logo/brand name in the nav is NOT a heading. Use a styled `<a>` or `<span>`.

---

## Landmark regions

Use semantic elements so screen readers and search engines can navigate the page outline:

| Element | Use for |
|---|---|
| `<nav>` | Primary navigation, footer nav |
| `<main>` | The main content of the page (one per page) |
| `<section>` | A thematic grouping with a heading |
| `<article>` | Self-contained content (blog post, card, listing) |
| `<aside>` | Related but secondary content (sidebar, callout) |
| `<footer>` | Site footer |
| `<header>` | Page header or section header (not the same as `<nav>`) |

When using multiple `<nav>` elements, distinguish them with `aria-label`:
```html
<nav aria-label="Main navigation">...</nav>
<nav aria-label="Footer navigation">...</nav>
```

---

## Section patterns

### Hero section
```html
<section id="hero" class="hero">
  <div class="hero-content">
    <p class="eyebrow">Category or label</p>
    <h1>Primary Headline</h1>
    <p class="lead">Supporting description, 1–2 sentences.</p>
    <div class="cta-group">
      <a href="/action" class="btn btn-primary">Primary CTA</a>
      <a href="/secondary" class="btn btn-outline">Secondary CTA</a>
    </div>
  </div>
  <div class="hero-media">
    <img src="assets/hero.jpg" alt="Descriptive alt text">
  </div>
</section>
```

### Content section
```html
<section id="about" class="section-about">
  <div class="section-inner">
    <p class="section-label">Section eyebrow</p>
    <h2>Section Heading</h2>
    <p>Body copy.</p>
  </div>
</section>
```

### Card grid
```html
<section id="features" class="section-features">
  <h2>Section Title</h2>
  <ul class="card-grid" role="list">
    <li class="card">
      <h3>Card Title</h3>
      <p>Card description.</p>
    </li>
  </ul>
</section>
```
Use `<ul>`/`<li>` for lists of cards — gives correct list semantics. Add `role="list"` when CSS removes list styling (fixes VoiceOver quirk).

---

## Nav patterns

### Primary nav
```html
<nav id="nav" class="nav" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Brand Name — Home">BRAND</a>
    <ul class="nav-links" role="list">
      <li><a href="/page">Page</a></li>
    </ul>
    <div class="nav-actions">
      <a href="/contact" class="btn">CTA</a>
      <button class="nav-menu-btn" id="menuBtn"
              aria-label="Open menu" aria-expanded="false"
              aria-controls="navOverlay">MENU</button>
    </div>
  </div>
</nav>
```

### Mobile overlay nav
```html
<div class="nav-overlay" id="navOverlay"
     role="dialog" aria-modal="true"
     aria-label="Navigation" aria-hidden="true">
  <div class="nav-overlay-header">
    <a href="/" class="nav-overlay-logo">BRAND</a>
    <button class="nav-overlay-close" id="navOverlayClose"
            aria-label="Close navigation">CLOSE</button>
  </div>
  <nav aria-label="Mobile navigation">
    <a href="/page">Page</a>
  </nav>
</div>
```
- `aria-hidden="true"` when closed, `false` when open
- `aria-expanded` on the trigger button toggles with the overlay
- `aria-controls` on the trigger points to the overlay `id`

---

## Footer pattern
```html
<footer class="footer">
  <div class="footer-brand">
    <a href="/" aria-label="Brand Name — Home">BRAND</a>
  </div>
  <nav class="footer-nav" aria-label="Footer navigation">
    <a href="/page">Page</a>
    <a href="/page">Page</a>
  </nav>
  <div class="footer-legal">
    <p>&copy; 2026 Brand Name. All rights reserved.</p>
  </div>
</footer>
```

---

## General rules

- Every `<img>` must have an `alt` attribute. Decorative images: `alt=""`. Informative images: describe what's in the image, not what it represents.
- Don't use `<div>` or `<span>` when a semantic element fits.
- Don't use heading tags for styling — use CSS classes.
- `<button>` for actions (toggles, submits, JS interactions). `<a href>` for navigation.
- External links should have `target="_blank" rel="noopener noreferrer"`.
- IDs must be unique per page.
