/* Property Finder Tool controller — Opportunity Feed / Saved / History /
   Settings tabs. Shares the page's top-level scope with portal.js (both are
   classic, non-module scripts loaded in order), which calls initPropertyFinder()
   from its showPage() lazy-load guard the same way it does loadMeetings()
   etc. See portal.js's `if (pageKey === 'finder' ...)` line. */
/* global L */
// NOTE: portal.js wraps its own code in a DOMContentLoaded closure, so its
// escapeHtml() is private to that closure, not a real global — this file
// needs its own copy rather than relying on portal.js's.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let finderLoaded = false;
let finderSavedLoaded = false;
let finderHistoryLoaded = false;
let finderSettingsLoaded = false;

let finderFeedViewMode = 'list'; // 'list' | 'detail' — mirrors archiveViewMode
let finderDetailListing = null;
let finderMapInstance = null;
let finderMapLayerGroup = null;

const finderFeedListView = document.getElementById('finderFeedListView');
const finderDetailView = document.getElementById('finderDetailView');
const finderFilterForm = document.getElementById('finderFilterForm');
const finderCardList = document.getElementById('finderCardList');
const finderFeedEmpty = document.getElementById('finderFeedEmpty');
const finderDetailBackBtn = document.getElementById('finderDetailBackBtn');
const finderDetailAddress = document.getElementById('finderDetailAddress');
const finderDetailSaveBtn = document.getElementById('finderDetailSaveBtn');
const finderZoningBreakdown = document.getElementById('finderZoningBreakdown');
const finderProFormaOutput = document.getElementById('finderProFormaOutput');
const finderSliderUnitCount = document.getElementById('finderSliderUnitCount');
const finderSliderAvgUnitSqft = document.getElementById('finderSliderAvgUnitSqft');
const finderSliderRent = document.getElementById('finderSliderRent');

const finderSavedList = document.getElementById('finderSavedList');
const finderSavedEmpty = document.getElementById('finderSavedEmpty');
const finderHistoryList = document.getElementById('finderHistoryList');
const finderSettingsForm = document.getElementById('finderSettingsForm');
const finderSettingsSavedMsg = document.getElementById('finderSettingsSavedMsg');

/* ---- Formatting helpers (mirrors mls-scraper's lib/format.ts) --- */
function fmtMoney(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(
    value || 0
  );
}
function fmtPercent(value, digits = 1) {
  return new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    value || 0
  );
}
function fmtSqft(value) {
  return `${Math.round(value || 0).toLocaleString('en-CA')} sqft`;
}

/* ---- Tab switching --------------------------------------------- */
function showFinderTab(tabKey) {
  document.querySelectorAll('.finder-subnav-btn').forEach((b) => b.classList.toggle('active', b.dataset.finderTab === tabKey));
  document.querySelectorAll('.finder-tab-panel').forEach((p) => {
    p.hidden = p.dataset.finderPanel !== tabKey;
  });
  if (tabKey === 'saved' && !finderSavedLoaded) loadFinderSaved();
  if (tabKey === 'history' && !finderHistoryLoaded) loadFinderHistory();
  if (tabKey === 'settings' && !finderSettingsLoaded) loadFinderSettings();
}

/* ---- Opportunity Feed -------------------------------------------- */
function finderCardHtml(item) {
  const run = item.latestRun;
  return `
    <div class="finder-card" data-id="${item.id}">
      <button type="button" class="finder-card-save" data-id="${item.id}" aria-label="${item.isSaved ? 'Unsave' : 'Save'}">${item.isSaved ? '★' : '☆'}</button>
      <div class="finder-card-main" data-id="${item.id}">
        <div class="finder-card-address">${escapeHtml(item.address)}</div>
        <div class="finder-card-meta">
          ${item.neighborhood ? `<span>${escapeHtml(item.neighborhood)}</span>` : ''}
          <span>${fmtMoney(item.listPrice)}</span>
          ${item.propertyType ? `<span>${escapeHtml(item.propertyType)}</span>` : ''}
        </div>
      </div>
      <div class="finder-card-stats">
        <div class="finder-card-stat"><span class="finder-card-stat-label">Cap Rate</span><span class="finder-card-stat-value">${fmtPercent(run.capRate)}</span></div>
        <div class="finder-card-stat"><span class="finder-card-stat-label">Cash/Cash ROI</span><span class="finder-card-stat-value">${fmtPercent(run.cashOnCashRoi)}</span></div>
        <div class="finder-card-stat"><span class="finder-card-stat-label">Units</span><span class="finder-card-stat-value">${run.buildableUnits}</span></div>
      </div>
      ${run.meetsThreshold ? '<span class="finder-card-badge">Meets Threshold</span>' : ''}
    </div>`;
}

async function loadFinderFeed(params = {}) {
  const query = new URLSearchParams();
  if (params.priceMin) query.set('priceMin', params.priceMin);
  if (params.priceMax) query.set('priceMax', params.priceMax);
  if (params.neighborhood) query.set('neighborhood', params.neighborhood);
  if (params.minCapRate) query.set('minCapRate', Number(params.minCapRate) / 100);
  if (params.runDate) query.set('runDate', params.runDate);

  let data = { listings: [] };
  try {
    const res = await fetch(`/api/property-finder/feed?${query.toString()}`);
    if (res.ok) data = await res.json();
  } catch {
    // leave feed empty; user can retry via the filter form
  }

  finderCardList.innerHTML = data.listings.map(finderCardHtml).join('');
  finderFeedEmpty.hidden = data.listings.length > 0;
}

function initPropertyFinder() {
  finderLoaded = true;

  document.querySelectorAll('.finder-subnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showFinderTab(btn.dataset.finderTab));
  });

  finderFilterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(finderFilterForm);
    loadFinderFeed(Object.fromEntries(formData.entries()));
  });

  finderCardList.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.finder-card-save');
    if (saveBtn) {
      toggleFinderSaved(Number(saveBtn.dataset.id), saveBtn);
      return;
    }
    const card = e.target.closest('.finder-card-main');
    if (card) openFinderDetail(Number(card.dataset.id));
  });

  finderDetailBackBtn.addEventListener('click', closeFinderDetail);

  [finderSliderUnitCount, finderSliderAvgUnitSqft, finderSliderRent].forEach((slider) => {
    slider.addEventListener('input', renderFinderProForma);
  });

  finderSettingsForm.addEventListener('submit', submitFinderSettings);

  loadFinderFeed();
}

async function toggleFinderSaved(listingId, btnEl) {
  const isSaved = btnEl.textContent.trim() === '★';
  btnEl.textContent = isSaved ? '☆' : '★'; // optimistic
  try {
    if (isSaved) {
      await fetch(`/api/property-finder/saved/${listingId}`, { method: 'DELETE' });
    } else {
      await fetch('/api/property-finder/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
    }
  } catch {
    btnEl.textContent = isSaved ? '★' : '☆'; // revert on failure
  }
}

/* ---- Property detail + pro forma what-if ------------------------ */
async function openFinderDetail(id) {
  let data;
  try {
    const res = await fetch(`/api/property-finder/listings/${id}`);
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }

  finderDetailListing = data;
  finderFeedViewMode = 'detail';
  finderFeedListView.hidden = true;
  finderDetailView.hidden = false;

  finderDetailAddress.textContent = data.listing.address;
  finderDetailSaveBtn.textContent = data.listing.isSaved ? '★ Saved' : '☆ Save';

  renderFinderZoningBreakdown(data);
  renderFinderMap(data);
  seedFinderProFormaSliders(data);
  renderFinderProForma();
}

function closeFinderDetail() {
  finderFeedViewMode = 'list';
  finderDetailView.hidden = true;
  finderFeedListView.hidden = false;
  finderDetailListing = null;
}

function renderFinderZoningBreakdown({ run }) {
  if (!run) {
    finderZoningBreakdown.innerHTML = '<p class="action-items-empty">No analysis run recorded for this listing yet.</p>';
    return;
  }
  const notes = (run.constraintNotes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  finderZoningBreakdown.innerHTML = `
    <div class="finder-zoning-grid">
      <div><span class="finder-zoning-label">Zone</span><span class="finder-zoning-value">${escapeHtml(run.zone_code || '—')} ${escapeHtml(run.zone_name || '')}</span></div>
      <div><span class="finder-zoning-label">Buildable Units</span><span class="finder-zoning-value">${run.buildable_units}</span></div>
      <div><span class="finder-zoning-label">Buildable Sqft</span><span class="finder-zoning-value">${fmtSqft(run.buildable_sqft)}</span></div>
      <div><span class="finder-zoning-label">Municipal Address</span><span class="finder-zoning-value">${escapeHtml(run.municipal_address || '—')}</span></div>
    </div>
    ${notes ? `<ul class="finder-zoning-notes">${notes}</ul>` : ''}
  `;
}

const FINDER_ZONE_COLORS = { N: '#b2977d', R: '#7d9db2', M: '#9db27d', C: '#b27d9d' };
function finderZoneColor(zoneCode) {
  const prefix = (zoneCode || '').charAt(0).toUpperCase();
  return FINDER_ZONE_COLORS[prefix] || '#8a8a8a';
}

function renderFinderMap({ listing, run }) {
  const mapEl = document.getElementById('finderDetailMap');
  if (!mapEl || typeof L === 'undefined') return;

  if (!finderMapInstance) {
    finderMapInstance = L.map(mapEl);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(finderMapInstance);
  }
  if (finderMapLayerGroup) finderMapLayerGroup.remove();
  finderMapLayerGroup = L.layerGroup().addTo(finderMapInstance);

  const lat = listing.lat;
  const lng = listing.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    L.marker([lat, lng]).addTo(finderMapLayerGroup);
    finderMapInstance.setView([lat, lng], 16);
  }
  if (run && run.geom && run.geom.type) {
    L.geoJSON(run.geom, { style: { color: finderZoneColor(run.zone_code), weight: 2, fillOpacity: 0.25 } }).addTo(
      finderMapLayerGroup
    );
  }
  setTimeout(() => finderMapInstance.invalidateSize(), 50);
}

function seedFinderProFormaSliders({ run }) {
  const unitCount = (run && run.buildable_units) || 1;
  const avgUnitSqft = run && run.buildable_units ? Math.round(run.buildable_sqft / run.buildable_units) : 800;
  const rentPerSqft =
    run && run.projectedRentRoll && run.projectedRentRoll.perUnitMonthlyRent && avgUnitSqft
      ? Number((run.projectedRentRoll.perUnitMonthlyRent / avgUnitSqft).toFixed(2))
      : 2.5;

  finderSliderUnitCount.value = unitCount;
  finderSliderAvgUnitSqft.value = avgUnitSqft;
  finderSliderRent.value = rentPerSqft;
}

function renderFinderProForma() {
  if (!finderDetailListing) return;
  const { listing, run, assumptions } = finderDetailListing;

  const input = {
    listPrice: listing.list_price,
    buildableSqft: (run && run.buildable_sqft) || 0,
    unitCount: Number(finderSliderUnitCount.value),
    avgUnitSqft: Number(finderSliderAvgUnitSqft.value),
    monthlyRentPerSqft: Number(finderSliderRent.value),
    assumptions: {
      costPerSqft: assumptions.cost_per_sqft,
      softCostPct: assumptions.soft_cost_pct,
      downPaymentPct: assumptions.down_payment_pct,
      interestRate: assumptions.interest_rate,
      amortizationYears: assumptions.amortization_years,
      vacancyRatePct: assumptions.vacancy_rate_pct,
      opexPctOfGpi: assumptions.opex_pct_of_gpi,
    },
  };

  const result = window.ProForma.computeProForma(input);

  document.getElementById('finderSliderUnitCountVal').textContent = input.unitCount;
  document.getElementById('finderSliderAvgUnitSqftVal').textContent = fmtSqft(input.avgUnitSqft);
  document.getElementById('finderSliderRentVal').textContent = `$${input.monthlyRentPerSqft.toFixed(2)}`;

  finderProFormaOutput.innerHTML = `
    <div class="finder-proforma-row"><span>Total Project Cost</span><strong>${fmtMoney(result.totalProjectCost)}</strong></div>
    <div class="finder-proforma-row"><span>NOI</span><strong>${fmtMoney(result.noi)}</strong></div>
    <div class="finder-proforma-row"><span>Cap Rate</span><strong>${fmtPercent(result.capRate)}</strong></div>
    <div class="finder-proforma-row"><span>Cash-on-Cash ROI</span><strong>${fmtPercent(result.cashOnCashRoi)}</strong></div>
  `;
}

finderDetailSaveBtn?.addEventListener('click', () => {
  if (!finderDetailListing) return;
  toggleFinderSaved(finderDetailListing.listing.id, {
    get textContent() { return finderDetailSaveBtn.textContent.includes('Saved') ? '★' : '☆'; },
    set textContent(v) { finderDetailSaveBtn.textContent = v === '★' ? '★ Saved' : '☆ Save'; },
  });
});

/* ---- Saved tab --------------------------------------------------- */
async function loadFinderSaved() {
  finderSavedLoaded = true;
  let data = { saved: [] };
  try {
    const res = await fetch('/api/property-finder/saved');
    if (res.ok) data = await res.json();
  } catch {
    // leave empty
  }
  finderSavedEmpty.hidden = data.saved.length > 0;
  finderSavedList.innerHTML = data.saved
    .map(
      (item) => `
    <div class="finder-card" data-id="${item.id}">
      <button type="button" class="finder-card-save" data-id="${item.id}" aria-label="Unsave">★</button>
      <div class="finder-card-main" data-id="${item.id}">
        <div class="finder-card-address">${escapeHtml(item.address)}</div>
        <div class="finder-card-meta">
          ${item.neighborhood ? `<span>${escapeHtml(item.neighborhood)}</span>` : ''}
          <span>${fmtMoney(item.listPrice)}</span>
        </div>
        ${item.notes ? `<div class="finder-card-notes">${escapeHtml(item.notes)}</div>` : ''}
      </div>
      ${
        item.latestRun
          ? `<div class="finder-card-stats">
               <div class="finder-card-stat"><span class="finder-card-stat-label">Cap Rate</span><span class="finder-card-stat-value">${fmtPercent(item.latestRun.capRate)}</span></div>
             </div>`
          : ''
      }
    </div>`
    )
    .join('');
}

finderSavedList.addEventListener('click', (e) => {
  const saveBtn = e.target.closest('.finder-card-save');
  if (saveBtn) {
    fetch(`/api/property-finder/saved/${saveBtn.dataset.id}`, { method: 'DELETE' }).then(() => loadFinderSaved());
    return;
  }
  const card = e.target.closest('.finder-card-main');
  if (card) {
    showFinderTab('feed');
    openFinderDetail(Number(card.dataset.id));
  }
});

/* ---- History tab --------------------------------------------------- */
async function loadFinderHistory() {
  finderHistoryLoaded = true;
  let data = { runs: [] };
  try {
    const res = await fetch('/api/property-finder/history');
    if (res.ok) data = await res.json();
  } catch {
    // leave empty
  }
  finderHistoryList.innerHTML = data.runs
    .map(
      (run) => `
    <li class="finder-history-row" data-run-date="${run.runDate}">
      <span>${new Date(run.runDate).toLocaleString('en-CA')}</span>
      <span>${run.listingCount} listing${run.listingCount === 1 ? '' : 's'}</span>
      <span>${run.meetsThresholdCount} meets threshold</span>
    </li>`
    )
    .join('');
}

finderHistoryList.addEventListener('click', (e) => {
  const row = e.target.closest('.finder-history-row');
  if (!row) return;
  showFinderTab('feed');
  loadFinderFeed({ runDate: row.dataset.runDate });
});

/* ---- Settings tab --------------------------------------------------- */
async function loadFinderSettings() {
  finderSettingsLoaded = true;
  let data;
  try {
    const res = await fetch('/api/property-finder/settings');
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }
  const form = finderSettingsForm;
  const a = data.assumptions;
  const p = data.preferences;
  form.costPerSqft.value = a.costPerSqft;
  form.softCostPct.value = a.softCostPct;
  form.downPaymentPct.value = a.downPaymentPct;
  form.interestRate.value = a.interestRate;
  form.amortizationYears.value = a.amortizationYears;
  form.vacancyRatePct.value = a.vacancyRatePct;
  form.opexPctOfGpi.value = a.opexPctOfGpi;
  form.minCapRate.value = p.minCapRate ?? '';
  form.minRoi.value = p.minRoi ?? '';
  form.priceMin.value = p.priceMin ?? '';
  form.priceMax.value = p.priceMax ?? '';
}

async function submitFinderSettings(e) {
  e.preventDefault();
  const form = finderSettingsForm;
  const body = {
    assumptions: {
      costPerSqft: Number(form.costPerSqft.value),
      softCostPct: Number(form.softCostPct.value),
      downPaymentPct: Number(form.downPaymentPct.value),
      interestRate: Number(form.interestRate.value),
      amortizationYears: Number(form.amortizationYears.value),
      vacancyRatePct: Number(form.vacancyRatePct.value),
      opexPctOfGpi: Number(form.opexPctOfGpi.value),
    },
    preferences: {
      minCapRate: form.minCapRate.value ? Number(form.minCapRate.value) : null,
      minRoi: form.minRoi.value ? Number(form.minRoi.value) : null,
      priceMin: form.priceMin.value ? Number(form.priceMin.value) : null,
      priceMax: form.priceMax.value ? Number(form.priceMax.value) : null,
    },
  };
  try {
    await fetch('/api/property-finder/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    finderSettingsSavedMsg.hidden = false;
    setTimeout(() => { finderSettingsSavedMsg.hidden = true; }, 2000);
  } catch {
    // form values stay as typed; user can retry
  }
}
