/* ============================================================
   FORTERA HOMES — main.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

/* ---- Nav scroll behaviour --------------------------------- */
const nav = document.getElementById('nav');
if (nav) {
  const heroEl = document.querySelector('.hero');
  const isHeroPage = !!heroEl;

  function updateNav() {
    if (isHeroPage) {
      if (window.scrollY > 60) {
        nav.classList.remove('nav--transparent');
        nav.classList.add('nav--solid');
      } else {
        nav.classList.add('nav--transparent');
        nav.classList.remove('nav--solid');
      }
    }
  }

  if (isHeroPage) {
    nav.classList.add('nav--transparent');
    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
  } else {
    nav.classList.add('nav--light');
  }
}

/* ---- Nav overlay ------------------------------------------ */
const menuBtn      = document.getElementById('menuBtn');
const navOverlay   = document.getElementById('navOverlay');
const navOverlayClose = document.getElementById('navOverlayClose');

function openOverlay() {
  if (!navOverlay) return;
  navOverlay.classList.add('open');
  navOverlay.setAttribute('aria-hidden', 'false');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  if (!navOverlay) return;
  navOverlay.classList.remove('open');
  navOverlay.setAttribute('aria-hidden', 'true');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

if (menuBtn) menuBtn.addEventListener('click', () => navOverlay.classList.contains('open') ? closeOverlay() : openOverlay());
if (navOverlayClose) navOverlayClose.addEventListener('click', closeOverlay);
if (navOverlay) {
  navOverlay.querySelectorAll('.nav-overlay-link').forEach(link => link.addEventListener('click', closeOverlay));
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && navOverlay && navOverlay.classList.contains('open')) closeOverlay();
});

/* ---- Reveal on scroll ------------------------------------- */
const reveals = document.querySelectorAll('.reveal');
if (reveals.length) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  reveals.forEach(el => revealObs.observe(el));
}

/* ---- Staggered reveal ------------------------------------- */
const staggerParents = document.querySelectorAll('.stagger-parent');
if (staggerParents.length) {
  const staggerObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.stagger-child').forEach((child, i) => {
          setTimeout(() => child.classList.add('visible'), i * 80);
        });
        staggerObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  staggerParents.forEach(el => staggerObs.observe(el));
}

/* ---- Project sub-nav active state ------------------------- */
const subnavLinks = document.querySelectorAll('.subnav-link');
if (subnavLinks.length) {
  const sections = Array.from(subnavLinks).map(link => {
    const id = link.getAttribute('href').replace('#', '');
    return document.getElementById(id);
  }).filter(Boolean);

  const subnavObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        subnavLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => subnavObs.observe(s));
}

/* ---- Unit filter tabs ------------------------------------- */
const filterTabs = document.querySelectorAll('.unit-filter-tab');
if (filterTabs.length) {
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const grid = document.querySelector('.units-grid');
      if (!grid) return;
      grid.style.opacity = '0';
      grid.style.transform = 'translateY(8px)';
      grid.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => {
        const floor = tab.dataset.filter;
        grid.querySelectorAll('.unit-card').forEach(card => {
          card.style.display = card.dataset.floor === floor ? 'flex' : 'none';
        });
        grid.style.opacity = '1';
        grid.style.transform = 'translateY(0)';
      }, 150);
    });
  });
}

/* ---- Gallery toggle (Exteriors / Interiors) --------------- */
const galleryToggleBtns = document.querySelectorAll('.gallery-toggle-btn');
if (galleryToggleBtns.length) {
  galleryToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      galleryToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      document.querySelectorAll('.gallery-grid').forEach(grid => {
        grid.style.display = grid.id === target ? 'grid' : 'none';
      });
    });
  });
}

/* ---- Gallery lightbox ------------------------------------- */
const lightbox = document.getElementById('galLightbox');
const lbImg = document.getElementById('galLbImg');
const lbCounter = document.getElementById('galLbCounter');

let galleryImages = [];
let currentLbIdx = 0;

function buildGalleryImages() {
  galleryImages = [];
  document.querySelectorAll('.gallery-item[data-src]').forEach(item => {
    galleryImages.push({ src: item.dataset.src, alt: item.dataset.alt || '' });
  });
}

function openLightbox(idx) {
  if (!lightbox || !lbImg) return;
  buildGalleryImages();
  currentLbIdx = idx;
  lbImg.src = galleryImages[idx].src;
  lbImg.alt = galleryImages[idx].alt;
  if (lbCounter) lbCounter.textContent = `${idx + 1} / ${galleryImages.length}`;
  lightbox.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

function lbNext() {
  currentLbIdx = (currentLbIdx + 1) % galleryImages.length;
  openLightbox(currentLbIdx);
}

function lbPrev() {
  currentLbIdx = (currentLbIdx - 1 + galleryImages.length) % galleryImages.length;
  openLightbox(currentLbIdx);
}

document.querySelectorAll('.gallery-item').forEach((item, idx) => {
  item.addEventListener('click', () => openLightbox(idx));
});

const lbClose = document.getElementById('galLbClose');
const lbNextBtn = document.getElementById('galLbNext');
const lbPrevBtn = document.getElementById('galLbPrev');
if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lbNextBtn) lbNextBtn.addEventListener('click', lbNext);
if (lbPrevBtn) lbPrevBtn.addEventListener('click', lbPrev);
if (lightbox) lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (!lightbox || lightbox.hasAttribute('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') lbNext();
  if (e.key === 'ArrowLeft') lbPrev();
});

/* ---- Accordion -------------------------------------------- */
document.querySelectorAll('.accordion-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const item = trigger.closest('.accordion-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ---- Waitlist form submission ----------------------------- */
const form = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');
const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');

    if (nameError) nameError.textContent = '';
    if (emailError) emailError.textContent = '';

    if (!name || !name.value.trim()) {
      if (nameError) nameError.textContent = 'Please enter your name.';
      valid = false;
    }
    if (!email || !email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      if (emailError) emailError.textContent = 'Please enter a valid email address.';
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('.form-submit');
    if (submitBtn) { submitBtn.textContent = 'SENDING…'; submitBtn.disabled = true; }

    try {
      const data = new FormData(form);
      const body = {};
      data.forEach((v, k) => body[k] = v);

      const res = await fetch('https://formspree.io/f/xjybyzjq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        form.style.display = 'none';
        if (formSuccess) {
          formSuccess.style.display = 'block';
          formSuccess.textContent = 'Thank you — we\'ll be in touch with early access details.';
        }
      } else {
        throw new Error('server error');
      }
    } catch {
      if (submitBtn) {
        submitBtn.textContent = 'SEND';
        submitBtn.disabled = false;
        submitBtn.style.borderColor = '#e07070';
      }
      if (emailError) emailError.textContent = 'Something went wrong. Please try again or email us directly.';
    }
  });
}

/* ---- Admin login -------------------------------------------- */
const adminForm = document.getElementById('adminLoginForm');
if (adminForm) {
  const adminSubmitBtn = document.getElementById('adminLoginSubmit');
  const adminErrorEl = document.getElementById('adminLoginError');

  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = adminForm.username.value.trim();
    const password = adminForm.password.value;
    const remember = adminForm.remember.checked;

    if (adminErrorEl) adminErrorEl.style.display = 'none';

    if (!username || !password) {
      if (adminErrorEl) {
        adminErrorEl.textContent = 'Enter your username and password.';
        adminErrorEl.style.display = 'block';
      }
      return;
    }

    if (adminSubmitBtn) {
      adminSubmitBtn.disabled = true;
      adminSubmitBtn.textContent = 'Signing In…';
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });

      if (res.ok) {
        window.location.href = '/admin-dashboard';
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (adminErrorEl) {
        adminErrorEl.textContent = data.error || 'Invalid username or password.';
        adminErrorEl.style.display = 'block';
      }
    } catch {
      if (adminErrorEl) {
        adminErrorEl.textContent = 'Something went wrong. Please try again.';
        adminErrorEl.style.display = 'block';
      }
    } finally {
      if (adminSubmitBtn) {
        adminSubmitBtn.disabled = false;
        adminSubmitBtn.textContent = 'Sign In';
      }
    }
  });
}

const adminPasswordToggle = document.getElementById('adminPasswordToggle');
const adminPasswordInput = document.getElementById('adminPassword');
if (adminPasswordToggle && adminPasswordInput) {
  adminPasswordToggle.addEventListener('click', () => {
    const showing = adminPasswordInput.type === 'text';
    adminPasswordInput.type = showing ? 'password' : 'text';
    adminPasswordToggle.setAttribute('aria-pressed', String(!showing));
    adminPasswordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
}

});
