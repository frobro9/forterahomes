/* ============================================================
   FORTERA HOMES, main.js
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

/* ---- Upcoming project "Coming Soon" flash ----------------- */
document.querySelectorAll('.project-card--upcoming').forEach(card => {
  let timer;
  const flash = () => {
    card.classList.add('is-soon');
    clearTimeout(timer);
    timer = setTimeout(() => card.classList.remove('is-soon'), 3000);
  };
  card.addEventListener('click', flash);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flash(); }
  });
});

/* ---- Floorplan lightbox ----------------------------------- */
const fpLightbox = document.getElementById('fpLightbox');
const fpLbImg = document.getElementById('fpLbImg');

function closeFpLightbox() {
  if (!fpLightbox) return;
  fpLightbox.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

document.querySelectorAll('.unit-floorplan[data-src]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!fpLightbox || !fpLbImg) return;
    fpLbImg.src = btn.dataset.src;
    fpLbImg.alt = btn.dataset.alt || '';
    fpLightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  });
});

const fpLbClose = document.getElementById('fpLbClose');
if (fpLbClose) fpLbClose.addEventListener('click', closeFpLightbox);
if (fpLightbox) fpLightbox.addEventListener('click', e => { if (e.target !== fpLbImg) closeFpLightbox(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && fpLightbox && !fpLightbox.hasAttribute('hidden')) closeFpLightbox();
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

/* ---- Register interest → lead intake ---------------------- */
const LEAD_INTAKE_URL = 'https://xaeekilxrzjavqplxhrb.supabase.co/functions/v1/lead-intake';

const form = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');
const formError = document.getElementById('formError');

if (form) {
  const REQUIRED = {
    firstName: 'Please enter your first name.',
    lastName: 'Please enter your last name.',
    email: 'Please enter a valid email address.',
    phone: 'Please enter your phone number.',
    moveIn: 'Please choose a move-in date.',
    lease_term: 'Please choose a lease term.',
    pets: 'Please let us know about pets.',
    preferred_unit_type: 'Please choose a unit type.',
  };

  const showErrors = (errors) => {
    form.querySelectorAll('[data-error-for]').forEach(el => {
      el.textContent = errors[el.dataset.errorFor] || '';
    });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formError) formError.textContent = '';

    const values = {};
    new FormData(form).forEach((v, k) => { values[k] = String(v).trim(); });

    const errors = {};
    Object.keys(REQUIRED).forEach(k => { if (!values[k]) errors[k] = REQUIRED[k]; });
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = REQUIRED.email;
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const submitBtn = form.querySelector('.form-submit');
    if (submitBtn) { submitBtn.textContent = 'SENDING…'; submitBtn.disabled = true; }

    // The intake form asks for name/email both as built-in fields and as custom questions.
    const body = {
      key: form.dataset.intakeKey,
      ...values,
      first_name: values.firstName,
      last_name: values.lastName,
      email_address: values.email,
      pets: values.pets === 'yes',
    };

    try {
      const res = await fetch(LEAD_INTAKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        form.style.display = 'none';
        if (formSuccess) {
          formSuccess.style.display = 'block';
          formSuccess.textContent = 'Thank you! Your application has been received. We\'ll be in touch soon.';
        }
        return;
      }

      if (data.fields) {
        const aliases = { first_name: 'firstName', last_name: 'lastName', email_address: 'email' };
        const fieldErrors = {};
        Object.entries(data.fields).forEach(([k, msg]) => { fieldErrors[aliases[k] || k] = msg; });
        showErrors(fieldErrors);
      }
      if (formError) formError.textContent = data.error || 'Something went wrong. Please try again or email us at admin@forterahomes.ca.';
    } catch {
      if (formError) formError.textContent = 'Something went wrong. Please try again or email us at admin@forterahomes.ca.';
    }

    if (submitBtn) { submitBtn.textContent = 'SUBMIT APPLICATION'; submitBtn.disabled = false; }
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

/* ---- Wifi offer bubble, expands to show offer details ---- */
const wifiOffer        = document.getElementById('wifiOffer');
const wifiOfferTrigger = document.getElementById('wifiOfferTrigger');
const wifiOfferDetails = document.getElementById('wifiOfferDetails');
if (wifiOffer && wifiOfferTrigger && wifiOfferDetails) {
  const setOpen = (open) => {
    wifiOffer.classList.toggle('is-open', open);
    wifiOfferTrigger.setAttribute('aria-expanded', String(open));
    wifiOfferDetails.hidden = !open;
  };
  wifiOfferTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!wifiOffer.classList.contains('is-open'));
  });
  document.addEventListener('click', (e) => {
    if (wifiOffer.classList.contains('is-open') && !wifiOffer.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wifiOffer.classList.contains('is-open')) { setOpen(false); wifiOfferTrigger.focus(); }
  });
}

/* ---- Video: lazy-load section clips, play only while visible ---- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lazyVideos = document.querySelectorAll('video.lazy-video[data-src]');
if (lazyVideos.length && !reduceMotion && 'IntersectionObserver' in window) {
  const videoObs = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (!v.src) { v.src = v.dataset.src; v.load(); }
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.15 });
  lazyVideos.forEach(v => videoObs.observe(v));
}
if (reduceMotion) {
  document.querySelectorAll('video[autoplay]').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
}

/* ---- Contact: inquiry type picker --------------------------- */
const inquiryPills = document.querySelectorAll('.inquiry-pill');
if (inquiryPills.length) {
  const panels = document.querySelectorAll('.inquiry-panel');
  const projectType = document.getElementById('projectType');
  const select = (pill) => {
    inquiryPills.forEach(p => p.setAttribute('aria-pressed', String(p === pill)));
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== pill.dataset.panel; });
    if (projectType && pill.dataset.label) projectType.value = pill.dataset.label;
  };
  inquiryPills.forEach(pill => pill.addEventListener('click', () => select(pill)));
  const type = new URLSearchParams(window.location.search).get('type');
  const initial = Array.from(inquiryPills).find(p => (p.dataset.types || '').split(' ').includes(type));
  if (initial) select(initial);
}

/* ---- Contact: multiplex + general inquiries ------------------ */
/* Inquiries post to the /api/inquiry Pages Function, which emails them via Resend
   (functions/api/inquiry.js). */
const INQUIRY_ENDPOINT = '/api/inquiry';

document.querySelectorAll('form.js-inquiry-form').forEach(form => {
  const btn = form.querySelector('.form-submit');
  const btnText = btn ? btn.textContent : '';
  const note = form.querySelector('[data-form-note]');
  const success = form.querySelector('[data-form-success]');
  const isGeneral = form.id === 'generalForm';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = {};
    new FormData(form).forEach((val, k) => { v[k] = String(val).trim(); });
    const errors = {};
    if (!v.name) errors.name = 'Please enter your name.';
    if (!v.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Please enter a valid email address.';
    if (!v.message) errors.message = isGeneral ? 'Please enter a message.' : 'Tell us a little about your project.';
    form.querySelectorAll('[data-error-for]').forEach(el => { el.textContent = errors[el.dataset.errorFor] || ''; });
    if (Object.keys(errors).length) return;

    const kind = v.project_type || form.dataset.kind || 'Inquiry';
    const subject = `${kind}: ${v.name}`;
    const lines = [
      `Inquiry: ${kind}`,
      `Name: ${v.name}`,
      `Email: ${v.email}`,
      v.phone && `Phone: ${v.phone}`,
      v.location && `Property / area: ${v.location}`,
      v.land && `Own the land: ${v.land}`,
      v.timeline && `Timeline: ${v.timeline}`,
    ].filter(Boolean).concat(['', v.message]);

    if (!INQUIRY_ENDPOINT) {
      window.location.href = `mailto:admin@forterahomes.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      if (note) note.textContent = 'Your email app should open with your message ready to send. If it doesn’t, email us at admin@forterahomes.ca.';
      return;
    }

    if (btn) { btn.textContent = 'SENDING…'; btn.disabled = true; }
    try {
      const res = await fetch(INQUIRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...v, inquiry: kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.fields) form.querySelectorAll('[data-error-for]').forEach(el => { el.textContent = data.fields[el.dataset.errorFor] || ''; });
        throw new Error(data.error || 'send failed');
      }
      form.querySelectorAll('.form-field, .form-row-2, .form-submit, [data-form-note]').forEach(el => { el.hidden = true; });
      if (success) { success.style.display = 'block'; success.textContent = form.dataset.success || 'Thanks! We’ll be in touch soon.'; }
    } catch (err) {
      if (note) note.textContent = (err && err.message && err.message !== 'send failed' && err.message !== 'Failed to fetch') ? err.message : 'Something went wrong sending your message. Please email us at admin@forterahomes.ca.';
      if (btn) { btn.textContent = btnText; btn.disabled = false; }
    }
  });
});

});

/* ---- "Apply for this suite": pre-select that suite's unit type in the form ---- */
(function () {
  const layout = document.getElementById('bwc-layout');
  if (!layout) return;
  document.querySelectorAll('.unit-cta').forEach(link => {
    link.addEventListener('click', () => {
      const card = link.closest('.unit-card');
      const name = card && card.querySelector('.unit-name');
      if (!name) return;
      const type = name.textContent.trim().split(/\s+/)[0].toLowerCase(); // "MACKAY A" -> "mackay"
      const opt = Array.from(layout.options).find(o => o.value.toLowerCase().startsWith(type));
      if (!opt) return;
      layout.value = opt.value;
      layout.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
})();
