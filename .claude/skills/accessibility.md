# Skill: Accessibility (a11y)

## Purpose
Audit and fix accessibility issues in HTML/CSS/JS — keyboard navigation, ARIA, color contrast, focus management, and screen reader support.

---

## Quick audit checklist

Run through these before marking any page complete:

- [ ] Every `<img>` has `alt` (empty `alt=""` for decorative)
- [ ] All interactive elements are keyboard-reachable (Tab order makes sense)
- [ ] Visible focus indicator on all focusable elements
- [ ] No keyboard trap (can Tab into and out of every component)
- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text (18px+ or 14px bold)
- [ ] No information conveyed by color alone
- [ ] Form inputs have associated `<label>` elements
- [ ] Buttons have descriptive text or `aria-label`
- [ ] Links have descriptive text (not "click here" or "read more")
- [ ] Page has a single `<h1>`, headings don't skip levels
- [ ] `<html lang="...">` is set correctly
- [ ] Interactive components (modals, dropdowns) manage focus correctly
- [ ] Motion-sensitive animations respect `prefers-reduced-motion`

---

## ARIA patterns

### Only use ARIA when native HTML isn't enough
Prefer `<button>` over `<div role="button">`. Prefer `<nav>` over `<div role="navigation">`. ARIA supplements semantics; it doesn't replace them.

### Modal / dialog
```html
<!-- Trigger -->
<button aria-haspopup="dialog" aria-expanded="false" aria-controls="myModal">
  Open Modal
</button>

<!-- Dialog -->
<div id="myModal" role="dialog" aria-modal="true"
     aria-labelledby="modalTitle" aria-hidden="true">
  <h2 id="modalTitle">Modal Heading</h2>
  <p>Content...</p>
  <button aria-label="Close modal">Close</button>
</div>
```

On open:
- Set `aria-hidden="false"` on dialog
- Set `aria-expanded="true"` on trigger
- Move focus to the first focusable element inside the dialog
- Trap focus within the dialog (Tab/Shift+Tab cycle inside only)
- Block scroll on `<body>`

On close:
- Set `aria-hidden="true"` on dialog
- Set `aria-expanded="false"` on trigger
- Return focus to the trigger element

### Toggle button
```html
<button aria-pressed="false" id="themeToggle">Dark mode</button>
```
Update `aria-pressed` to `"true"` when active.

### Expandable section / accordion
```html
<button aria-expanded="false" aria-controls="panel1">Section title</button>
<div id="panel1" hidden>
  <p>Content...</p>
</div>
```
Toggle `aria-expanded` and the `hidden` attribute together.

### Navigation with current page
```html
<nav aria-label="Main navigation">
  <a href="/" aria-current="page">Home</a>
  <a href="/about">About</a>
</nav>
```

### Icon-only buttons and links
```html
<!-- Button with icon only -->
<button aria-label="Close">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>

<!-- Link with icon only -->
<a href="https://instagram.com/brand" aria-label="Brand on Instagram"
   target="_blank" rel="noopener noreferrer">
  <svg aria-hidden="true" focusable="false">...</svg>
</a>
```
Always `aria-hidden="true"` and `focusable="false"` on decorative SVGs inside interactive elements.

---

## Focus management

### Visible focus styles (never remove outline without replacement)
```css
/* Global: ensure something is always visible */
:focus-visible {
  outline: 2px solid #0070f3;
  outline-offset: 2px;
}

/* Remove outline only when mouse-driven (pointer) */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Skip link (required for keyboard users on every page)
```html
<!-- First element inside <body> -->
<a class="skip-link" href="#main-content">Skip to main content</a>

<main id="main-content">...</main>
```
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 9999;
}
.skip-link:focus {
  top: 0;
}
```

---

## Forms

```html
<form>
  <div class="field">
    <label for="email">Email address</label>
    <input type="email" id="email" name="email"
           autocomplete="email" required
           aria-describedby="email-hint email-error">
    <p id="email-hint" class="hint">We'll never share your email.</p>
    <p id="email-error" class="error" role="alert" hidden>
      Please enter a valid email address.
    </p>
  </div>

  <button type="submit">Submit</button>
</form>
```

- `for` / `id` pairing is mandatory on every input
- `aria-describedby` links hints and errors to the input
- `role="alert"` on error messages triggers immediate screen reader announcement
- Group related fields with `<fieldset>` and `<legend>`
- Never use `placeholder` as a label substitute

---

## Motion and animation

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Alternatively, apply only to specific components:
```css
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
}
```

---

## Color contrast quick reference

| Text size | Min contrast ratio |
|---|---|
| Normal text (< 18px regular, < 14px bold) | 4.5:1 |
| Large text (≥ 18px regular, ≥ 14px bold) | 3:1 |
| UI components, icons, borders | 3:1 |
| Decorative elements | No requirement |

Test with: https://webaim.org/resources/contrastchecker/
