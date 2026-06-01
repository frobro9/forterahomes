/* ============================================================
   FORTERA HOMES — main.js
   ============================================================ */

'use strict';

/* --- Nav: add scrolled class ------------------------------- */
const nav            = document.getElementById('nav');
const scrollProgress = document.getElementById('scrollProgress');

const onScroll = () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
  if (scrollProgress) {
    const pct = window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight) * 100;
    scrollProgress.style.width = Math.min(pct, 100) + '%';
  }
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* --- Mobile menu toggle ------------------------------------ */
const menuBtn  = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

menuBtn.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  menuBtn.classList.toggle('open', isOpen);
  menuBtn.setAttribute('aria-expanded', isOpen);
  mobileMenu.setAttribute('aria-hidden', !isOpen);
});

// Close menu when a link is clicked
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', false);
    mobileMenu.setAttribute('aria-hidden', true);
  });
});

/* --- Number counter animation ------------------------------ */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  if (isNaN(target)) return;
  const from = el.dataset.from ? parseInt(el.dataset.from, 10) : 0;
  const dur  = 1500;
  const t0   = performance.now();
  (function tick(now) {
    const p     = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

/* --- Reveal animations ------------------------------------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('[data-target]').forEach(animateCounter);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* --- Contact form ------------------------------------------ */
const form        = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic validation
    let valid = true;

    const required = form.querySelectorAll('[required]');
    required.forEach(field => {
      field.classList.remove('error');
      if (!field.value.trim()) {
        field.classList.add('error');
        valid = false;
      }
    });

    // Email format check
    const emailField = form.querySelector('#email');
    if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
      emailField.classList.add('error');
      valid = false;
    }

    if (!valid) return;

    // Collect data
    const data = {
      name:    form.querySelector('#name').value.trim(),
      email:   form.querySelector('#email').value.trim(),
      phone:   form.querySelector('#phone').value.trim(),
      message: form.querySelector('#message').value.trim(),
    };

    // In production replace this with your form handler (e.g. Formspree, Netlify Forms, etc.)
    console.log('Registration submitted:', data);

    // Show success state
    form.hidden = true;
    formSuccess.hidden = false;
  });

  // Clear error state on input
  form.querySelectorAll('input, textarea').forEach(field => {
    field.addEventListener('input', () => field.classList.remove('error'));
  });
}

/* --- Smooth scroll offset for fixed nav ------------------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h') || '72', 10);
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
