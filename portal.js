/* ============================================================
   FORTERA HOMES — Management Portal
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- Sidebar nav: expand/collapse + page switching --------- */
const navParents = document.querySelectorAll('.portal-nav-parent');
navParents.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.childrenTarget;
    const children = document.querySelector(`[data-children="${key}"]`);
    if (!children) return;
    const isOpen = children.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });
});

const navLeaves = document.querySelectorAll('.portal-nav-leaf');
const pages = document.querySelectorAll('.portal-page');
const validPages = Array.from(pages).map((p) => p.dataset.page);

function showPage(pageKey) {
  pages.forEach((p) => p.classList.toggle('active', p.dataset.page === pageKey));
  navLeaves.forEach((l) => l.classList.toggle('active', l.dataset.page === pageKey));
  history.replaceState(null, '', `#${pageKey}`);
  if (pageKey === 'action-items' && !actionItemsLoaded) loadActionItems();
  if (pageKey === 'calendar' && !calendarLoaded) loadCalendar();
  if (pageKey === 'finder' && !finderLoaded) loadFinder();
}

navLeaves.forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

/* ---- Welcome greeting ----------------------------------------- */
const portalWelcome = document.getElementById('portalWelcome');
if (portalWelcome) {
  fetch('/api/me')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.firstName) return;
      portalWelcome.textContent = `Welcome, ${data.firstName}.`;
      portalWelcome.hidden = false;
    })
    .catch(() => {});
}

/* ---- Logout -------------------------------------------------- */
const logoutBtn = document.getElementById('portalLogoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/admin';
  });
}

/* ================================================================
   ACTION ITEMS
   ================================================================ */
let actionItemsLoaded = false;
let actionItems = [];
let actionItemsSort = 'priority';
let actionItemsTab = 'active';
let pendingDeleteId = null;

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, na: 3 };
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', na: 'N/A' };

const actionItemsListEl = document.getElementById('actionItemsList');
const actionItemsForm = document.getElementById('actionItemsForm');
const actionItemsSortBtns = document.querySelectorAll('.action-items-sort-btn[data-sort]');
const actionItemsTabBtns = document.querySelectorAll('.action-items-sort-btn[data-tab]');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmCancel = document.getElementById('deleteConfirmCancel');
const deleteConfirmConfirm = document.getElementById('deleteConfirmConfirm');

/* ---- Owner multi-select (add task form) ------------------------ */
const ownerField = document.getElementById('actionItemOwnerField');
const ownerTrigger = document.getElementById('actionItemOwnerTrigger');
const ownerLabel = document.getElementById('actionItemOwnerLabel');
const ownerPanel = document.getElementById('actionItemOwnerPanel');
const ownerCheckboxes = ownerPanel ? Array.from(ownerPanel.querySelectorAll('input[type="checkbox"]')) : [];
const ownerAllCheckbox = ownerPanel ? ownerPanel.querySelector('input[value="All"]') : null;

function updateOwnerLabel() {
  const selected = ownerCheckboxes.filter((cb) => cb.checked && cb.value !== 'All').map((cb) => cb.value);
  if (ownerAllCheckbox && ownerAllCheckbox.checked) {
    ownerLabel.textContent = 'All';
  } else if (selected.length) {
    ownerLabel.textContent = selected.join(', ');
  } else {
    ownerLabel.textContent = 'Assign to';
  }
}

function getSelectedOwnerValue() {
  if (ownerAllCheckbox && ownerAllCheckbox.checked) return 'All';
  return ownerCheckboxes
    .filter((cb) => cb.checked && cb.value !== 'All')
    .map((cb) => cb.value)
    .join(', ');
}

function resetOwnerSelect() {
  ownerCheckboxes.forEach((cb) => { cb.checked = false; });
  updateOwnerLabel();
}

function closeOwnerPanel() {
  if (!ownerPanel || ownerPanel.hidden) return;
  ownerPanel.hidden = true;
  ownerTrigger.setAttribute('aria-expanded', 'false');
}

if (ownerTrigger && ownerPanel) {
  ownerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !ownerPanel.hidden;
    ownerPanel.hidden = isOpen;
    ownerTrigger.setAttribute('aria-expanded', String(!isOpen));
  });

  ownerCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.value === 'All' && cb.checked) {
        ownerCheckboxes.forEach((other) => { if (other !== cb) other.checked = false; });
      } else if (cb.checked && ownerAllCheckbox) {
        ownerAllCheckbox.checked = false;
      }
      updateOwnerLabel();
    });
  });

  document.addEventListener('click', (e) => {
    if (!ownerField.contains(e.target)) closeOwnerPanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOwnerPanel();
  });
}

async function loadActionItems() {
  actionItemsLoaded = true;
  try {
    const res = await fetch('/api/tasks?property=beechwood');
    const data = await res.json();
    actionItems = data.tasks || [];
    renderActionItems();
  } catch {
    actionItemsListEl.innerHTML = '<li class="action-items-empty">Couldn’t load action items. Please refresh.</li>';
  }
}

function sortedActionItems() {
  const tasks = actionItems.filter((t) => Boolean(t.completed) === (actionItemsTab === 'completed'));
  if (actionItemsSort === 'due_date') {
    tasks.sort((a, b) => {
      if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name);
    });
  } else {
    tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.name.localeCompare(b.name));
  }
  return tasks;
}

function ownerTagsHtml(owner) {
  if (!owner) return '';
  const names = owner === 'All' ? ['All'] : owner.split(', ');
  return names
    .map((n) => `<span class="action-items-owner-tag${n === 'All' ? ' action-items-owner-tag--all' : ''}">${escapeHtml(n)}</span>`)
    .join('');
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d) < today;
}

function renderActionItems() {
  const tasks = sortedActionItems();
  if (!tasks.length) {
    const emptyMsg = actionItemsTab === 'completed' ? 'No completed tasks yet.' : 'No tasks yet — add one above.';
    actionItemsListEl.innerHTML = `<li class="action-items-empty">${emptyMsg}</li>`;
    return;
  }
  actionItemsListEl.innerHTML = tasks
    .map(
      (t) => `
    <li class="action-items-row ${t.completed ? 'is-completed' : ''}" data-id="${t.id}">
      <div class="action-items-row-main">
        <span class="action-items-priority-dot action-items-priority-dot--${t.priority}"></span>
        <span class="action-items-priority-label">${PRIORITY_LABEL[t.priority]}</span>
        <span class="action-items-row-name">${escapeHtml(t.name)}</span>
      </div>
      <div class="action-items-row-meta">
        <span class="action-items-row-owner">${ownerTagsHtml(t.owner)}</span>
        <span class="action-items-row-due ${isOverdue(t.due_date) ? 'is-overdue' : ''}">${formatShortDate(t.due_date)}</span>
        <div class="action-items-row-actions">
          ${
            t.completed
              ? ''
              : `<button type="button" class="action-items-row-complete" aria-label="Mark complete" data-id="${t.id}">&#10003;</button>`
          }
          <button type="button" class="action-items-row-delete" aria-label="Delete task" data-id="${t.id}">&times;</button>
        </div>
      </div>
    </li>`
    )
    .join('');
}

actionItemsSortBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    actionItemsSort = btn.dataset.sort;
    actionItemsSortBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderActionItems();
  });
});

actionItemsTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    actionItemsTab = btn.dataset.tab;
    actionItemsTabBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderActionItems();
  });
});

if (actionItemsForm) {
  actionItemsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('actionItemName').value.trim();
    const priority = document.getElementById('actionItemPriority').value;
    const owner = getSelectedOwnerValue();
    const dueDate = document.getElementById('actionItemDueDate').value || null;
    if (!name || !owner) return;

    const submitBtn = actionItemsForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, priority, owner, dueDate, property: 'beechwood' }),
      });
      if (res.ok) {
        const data = await res.json();
        actionItems.push(data.task);
        renderActionItems();
        const newRow = actionItemsListEl.querySelector(`[data-id="${data.task.id}"]`);
        if (newRow) {
          newRow.classList.add('is-entering');
          requestAnimationFrame(() => requestAnimationFrame(() => newRow.classList.remove('is-entering')));
        }
        actionItemsForm.reset();
        resetOwnerSelect();
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markActionItemComplete(id, row) {
  if (row) {
    row.style.pointerEvents = 'none';
    row.classList.add('is-completing');
  }

  const patchPromise = fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });

  // Let the success flash + checkmark pulse play, then slide the row out,
  // before swapping the data underneath it.
  await wait(350);
  if (row) row.classList.add('is-removing');
  await wait(250);

  try {
    const res = await patchPromise;
    if (res.ok) {
      const data = await res.json();
      const idx = actionItems.findIndex((t) => t.id === id);
      if (idx !== -1) actionItems[idx] = data.task;
      renderActionItems();
    } else if (row) {
      row.style.pointerEvents = '';
      row.classList.remove('is-completing', 'is-removing');
    }
  } catch {
    if (row) {
      row.style.pointerEvents = '';
      row.classList.remove('is-completing', 'is-removing');
    }
  }
}

if (actionItemsListEl) {
  actionItemsListEl.addEventListener('click', async (e) => {
    const completeBtn = e.target.closest('.action-items-row-complete');
    if (completeBtn) {
      const id = Number(completeBtn.dataset.id);
      const row = completeBtn.closest('.action-items-row');
      await markActionItemComplete(id, row);
      return;
    }

    const deleteBtn = e.target.closest('.action-items-row-delete');
    if (deleteBtn) {
      pendingDeleteId = Number(deleteBtn.dataset.id);
      deleteConfirmModal.hidden = false;
    }
  });
}

async function confirmDeleteActionItem() {
  if (pendingDeleteId === null) return;
  const id = pendingDeleteId;
  deleteConfirmModal.hidden = true;
  pendingDeleteId = null;

  const row = actionItemsListEl.querySelector(`.action-items-row[data-id="${id}"]`);
  if (row) row.classList.add('is-removing');
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      actionItems = actionItems.filter((t) => t.id !== id);
      setTimeout(renderActionItems, 200);
    } else if (row) {
      row.classList.remove('is-removing');
    }
  } catch {
    if (row) row.classList.remove('is-removing');
  }
}

if (deleteConfirmConfirm) deleteConfirmConfirm.addEventListener('click', confirmDeleteActionItem);
if (deleteConfirmCancel) {
  deleteConfirmCancel.addEventListener('click', () => {
    pendingDeleteId = null;
    deleteConfirmModal.hidden = true;
  });
}
if (deleteConfirmModal) {
  deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) {
      pendingDeleteId = null;
      deleteConfirmModal.hidden = true;
    }
  });
}

/* ================================================================
   CALENDAR
   ================================================================ */
let calendarLoaded = false;
let calEvents = [];
let calViewYear;
let calViewMonth;

const calMonthLabel = document.getElementById('calMonthLabel');
const calWeeksEl = document.getElementById('calWeeks');
const calSummaryList = document.getElementById('calSummaryList');
const calModal = document.getElementById('calModal');
const calEventForm = document.getElementById('calEventForm');
const calEventError = document.getElementById('calEventError');
const calAddEventBtn = document.getElementById('calAddEventBtn');
const calModalCancel = document.getElementById('calModalCancel');
const calPrevBtn = document.getElementById('calPrevBtn');
const calNextBtn = document.getElementById('calNextBtn');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const CAL_EVENT_COLORS = [
  '#a6785c', '#5c7f8f', '#8f6b9e', '#7a9459',
  '#c17f4f', '#557a9e', '#b06a86', '#6f8f7a',
];

function calEventColor(ev) {
  return CAL_EVENT_COLORS[ev.id % CAL_EVENT_COLORS.length];
}

async function loadCalendar() {
  calendarLoaded = true;
  const now = new Date();
  calViewYear = now.getFullYear();
  calViewMonth = now.getMonth();
  try {
    const res = await fetch('/api/events?property=beechwood');
    const data = await res.json();
    calEvents = data.events || [];
  } catch {
    calEvents = [];
  }
  renderCalendar();
}

if (calPrevBtn) {
  calPrevBtn.addEventListener('click', () => {
    calViewMonth -= 1;
    if (calViewMonth < 0) {
      calViewMonth = 11;
      calViewYear -= 1;
    }
    renderCalendar();
  });
}

if (calNextBtn) {
  calNextBtn.addEventListener('click', () => {
    calViewMonth += 1;
    if (calViewMonth > 11) {
      calViewMonth = 0;
      calViewYear += 1;
    }
    renderCalendar();
  });
}

function renderCalendar() {
  if (!calMonthLabel || !calWeeksEl) return;
  calMonthLabel.textContent = `${MONTH_NAMES[calViewMonth]} ${calViewYear}`;

  const firstOfMonth = new Date(calViewYear, calViewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(calViewYear, calViewMonth, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsedEvents = calEvents.map((ev) => ({ ev, start: parseDate(ev.start_date), end: parseDate(ev.end_date) }));

  let html = '';
  for (let w = 0; w < 6; w++) {
    const weekDays = cells.slice(w * 7, w * 7 + 7);
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];

    const weekEvents = parsedEvents.filter(({ start, end }) => end >= weekStart && start <= weekEnd);

    const lanes = [];
    weekEvents.forEach((item) => {
      let laneIdx = lanes.findIndex((lane) => lane.every((other) => item.end < other.start || item.start > other.end));
      if (laneIdx === -1) {
        laneIdx = lanes.length;
        lanes.push([]);
      }
      lanes[laneIdx].push(item);
      item.lane = laneIdx;
    });

    const dayCellsHtml = weekDays
      .map((d) => {
        const isMuted = d.getMonth() !== calViewMonth;
        const isToday = d.getTime() === today.getTime();
        return `<div class="cal-day ${isMuted ? 'cal-day--muted' : ''} ${isToday ? 'cal-day--today' : ''}"><span class="cal-day-num">${d.getDate()}</span></div>`;
      })
      .join('');

    const barsHtml = weekEvents
      .map((item) => {
        const startCol = Math.max(0, Math.round((item.start - weekStart) / 86400000));
        const endCol = Math.min(6, Math.round((item.end - weekStart) / 86400000));
        const left = (startCol / 7) * 100;
        const width = ((endCol - startCol + 1) / 7) * 100;
        const top = item.lane * 22;
        const color = calEventColor(item.ev);
        return `<div class="cal-event-bar" style="left:${left}%;width:calc(${width}% - 4px);top:${top}px;background:${color}" title="${escapeHtml(item.ev.name)}">${escapeHtml(item.ev.name)}</div>`;
      })
      .join('');

    html += `<div class="cal-week" style="padding-bottom:${lanes.length ? lanes.length * 22 : 0}px">
      ${dayCellsHtml}
      <div class="cal-week-events">${barsHtml}</div>
    </div>`;
  }

  calWeeksEl.innerHTML = html;
  renderCalSummary();
}

function durationLabel(startStr, endStr) {
  const days = Math.round((parseDate(endStr) - parseDate(startStr)) / 86400000) + 1;
  return days === 1 ? '1 day' : `${days} days`;
}

function renderCalSummary() {
  if (!calSummaryList) return;
  if (!calEvents.length) {
    calSummaryList.innerHTML = '<div class="cal-summary-empty">No events yet — add one to start the timeline.</div>';
    return;
  }
  const sorted = [...calEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
  calSummaryList.innerHTML = sorted
    .map(
      (ev) => `
    <div class="cal-summary-row">
      <span class="cal-summary-swatch" style="background:${calEventColor(ev)}"></span>
      <span class="cal-summary-name">${escapeHtml(ev.name)}</span>
      <span class="cal-summary-dates">${formatShortDate(ev.start_date)} – ${formatShortDate(ev.end_date)}</span>
      <span class="cal-summary-duration">${durationLabel(ev.start_date, ev.end_date)}</span>
      <button type="button" class="cal-summary-remove" aria-label="Remove event" data-id="${ev.id}">&times;</button>
    </div>`
    )
    .join('');
}

if (calAddEventBtn) {
  calAddEventBtn.addEventListener('click', () => {
    calEventError.style.display = 'none';
    calEventForm.reset();
    calModal.hidden = false;
  });
}
if (calModalCancel) calModalCancel.addEventListener('click', () => { calModal.hidden = true; });
if (calModal) calModal.addEventListener('click', (e) => { if (e.target === calModal) calModal.hidden = true; });

if (calEventForm) {
  calEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('calEventName').value.trim();
    const startDate = document.getElementById('calEventStart').value;
    const endDate = document.getElementById('calEventEnd').value;
    calEventError.style.display = 'none';

    if (!name || !startDate || !endDate) {
      calEventError.textContent = 'Fill in all fields.';
      calEventError.style.display = 'block';
      return;
    }
    if (endDate < startDate) {
      calEventError.textContent = 'End date must be on or after the start date.';
      calEventError.style.display = 'block';
      return;
    }

    const submitBtn = calEventForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startDate, endDate, property: 'beechwood' }),
      });
      const data = await res.json();
      if (res.ok) {
        calEvents.push(data.event);
        calModal.hidden = true;
        renderCalendar();
      } else {
        calEventError.textContent = data.error || 'Something went wrong.';
        calEventError.style.display = 'block';
      }
    } catch {
      calEventError.textContent = 'Something went wrong. Please try again.';
      calEventError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (calSummaryList) {
  calSummaryList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.cal-summary-remove');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        calEvents = calEvents.filter((ev) => ev.id !== id);
        renderCalendar();
      }
    } catch {
      // leave list as-is; user can retry
    }
  });
}

/* ================================================================
   PROPERTY FINDER TOOL
   ================================================================ */
let finderLoaded = false;
let finderSettings = null;
let finderAnalyses = [];

const FINDER_ZONE_LABELS = {
  R1: 'Low Density — Single-Detached',
  R2: 'Low-Medium Density — Semi/Duplex',
  R3: 'Medium Density — Townhome / Low-Rise',
  R4: 'Medium-High Density — Low-Rise Apartment',
  R5: 'High Density — Apartment',
  AM: 'Mixed-Use — Arterial Mainstreet',
  TM: 'Mixed-Use — Traditional Mainstreet',
  GM: 'Mixed-Use — General Mainstreet',
  MC: 'Mixed-Use Centre',
  MD: 'Mixed-Use Downtown',
  RU: 'Rural',
  AG: 'Agricultural',
  EP: 'Environmental Protection',
};

function finderZoneLabel(zoneMain) {
  return FINDER_ZONE_LABELS[(zoneMain || '').toUpperCase()] || 'Unclassified / Other';
}

const finderCurrencyFmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
function formatFinderCurrency(n) {
  return finderCurrencyFmt.format(Number(n) || 0);
}
function formatFinderPercent(n) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}
function finderScoreClass(score) {
  if (score >= 75) return 'finder-score--good';
  if (score >= 50) return 'finder-score--ok';
  return 'finder-score--poor';
}

const finderForm = document.getElementById('finderForm');
const finderFormError = document.getElementById('finderFormError');
const finderResultEl = document.getElementById('finderResult');
const finderHistoryList = document.getElementById('finderHistoryList');
const finderSettingsBtn = document.getElementById('finderSettingsBtn');
const finderSettingsModal = document.getElementById('finderSettingsModal');
const finderSettingsForm = document.getElementById('finderSettingsForm');
const finderSettingsError = document.getElementById('finderSettingsError');
const finderSettingsCancel = document.getElementById('finderSettingsCancel');

async function loadFinder() {
  finderLoaded = true;
  try {
    const [settingsRes, analysesRes] = await Promise.all([
      fetch('/api/finder-settings'),
      fetch('/api/finder-analyses'),
    ]);
    const settingsData = await settingsRes.json();
    const analysesData = await analysesRes.json();
    finderSettings = settingsData.settings || null;
    finderAnalyses = analysesData.analyses || [];
    renderFinderHistory();
  } catch {
    if (finderHistoryList) finderHistoryList.innerHTML = '<p class="finder-history-empty">Couldn’t load past analyses.</p>';
  }
}

function renderFinderResult(analysis, scoreBreakdown) {
  if (!finderResultEl) return;
  finderResultEl.hidden = false;
  const scoreClass = finderScoreClass(analysis.score);
  finderResultEl.innerHTML = `
    <div class="finder-result-header">
      <div class="finder-score-badge ${scoreClass}">
        <span class="finder-score-value">${Math.round(analysis.score)}</span>
        <span class="finder-score-max">/100</span>
      </div>
      <div class="finder-result-heading">
        <p class="finder-result-address">${escapeHtml(analysis.address)}</p>
        <p class="finder-result-zone">${escapeHtml(analysis.zone_code || 'Zone unknown')} — ${escapeHtml(finderZoneLabel(analysis.zone_main))}</p>
      </div>
    </div>
    <div class="finder-result-grid">
      <div class="finder-stat"><span class="finder-stat-label">Est. Units</span><span class="finder-stat-value">${analysis.estimated_units}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Buildable Sq Ft</span><span class="finder-stat-value">${Math.round(analysis.estimated_buildable_sqft).toLocaleString()}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Land $/Sq Ft</span><span class="finder-stat-value">${formatFinderCurrency(analysis.cost_per_sqft_land)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Hard Cost</span><span class="finder-stat-value">${formatFinderCurrency(analysis.hard_cost)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Soft Cost</span><span class="finder-stat-value">${formatFinderCurrency(analysis.soft_cost)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Total Project Cost</span><span class="finder-stat-value">${formatFinderCurrency(analysis.total_project_cost)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Annual Gross Rent</span><span class="finder-stat-value">${formatFinderCurrency(analysis.annual_gross_rent)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">NOI</span><span class="finder-stat-value">${formatFinderCurrency(analysis.noi)}</span></div>
      <div class="finder-stat"><span class="finder-stat-label">Cap Rate</span><span class="finder-stat-value">${formatFinderPercent(analysis.cap_rate)}</span></div>
    </div>
    ${scoreBreakdown ? `
    <div class="finder-score-breakdown">
      <span>Cap rate fit ${Math.round(scoreBreakdown.capRateComponent)}</span>
      <span>Land cost fit ${Math.round(scoreBreakdown.costComponent)}</span>
      <span>Density ${Math.round(scoreBreakdown.densityComponent)}</span>
    </div>` : ''}
    <p class="finder-disclaimer">Estimate only — the zoning-derived unit count is a planning-level heuristic, not a confirmed site plan. Confirm with a zoning professional before purchase.</p>
  `;
}

function renderFinderHistory() {
  if (!finderHistoryList) return;
  if (!finderAnalyses.length) {
    finderHistoryList.innerHTML = '<p class="finder-history-empty">No analyses yet — run one above.</p>';
    return;
  }
  finderHistoryList.innerHTML = finderAnalyses
    .map(
      (a) => `
    <div class="finder-history-row" data-id="${a.id}">
      <span class="finder-history-score ${finderScoreClass(a.score)}">${Math.round(a.score)}</span>
      <div class="finder-history-main">
        <span class="finder-history-address">${escapeHtml(a.address)}</span>
        <span class="finder-history-meta">${escapeHtml(a.zone_code || '—')} · ${a.estimated_units} units · ${formatFinderCurrency(a.list_price)}</span>
      </div>
      <button type="button" class="finder-history-remove" aria-label="Delete analysis" data-id="${a.id}">&times;</button>
    </div>`
    )
    .join('');
}

if (finderForm) {
  finderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    finderFormError.style.display = 'none';
    const address = document.getElementById('finderAddress').value.trim();
    const listPrice = document.getElementById('finderListPrice').value;
    const lotSqft = document.getElementById('finderLotSqft').value;
    if (!address || !listPrice || !lotSqft) return;

    const submitBtn = document.getElementById('finderSubmitBtn');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Analyzing…';

    try {
      const res = await fetch('/api/finder-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, listPrice: Number(listPrice), lotSqft: Number(lotSqft) }),
      });
      const data = await res.json();
      if (res.ok) {
        finderAnalyses.unshift(data.analysis);
        renderFinderResult(data.analysis, data.scoreBreakdown);
        renderFinderHistory();
        finderForm.reset();
      } else {
        finderFormError.textContent = data.error || 'Something went wrong.';
        finderFormError.style.display = 'block';
      }
    } catch {
      finderFormError.textContent = 'Something went wrong. Please try again.';
      finderFormError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

if (finderHistoryList) {
  finderHistoryList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.finder-history-remove');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    try {
      const res = await fetch(`/api/finder-analyses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        finderAnalyses = finderAnalyses.filter((a) => a.id !== id);
        renderFinderHistory();
      }
    } catch {
      // leave list as-is; user can retry
    }
  });
}

const FINDER_SETTINGS_FIELD_IDS = {
  hard_cost_per_sqft: 'fsHardCost',
  soft_cost_pct: 'fsSoftCost',
  avg_unit_sqft: 'fsUnitSqft',
  avg_monthly_rent: 'fsRent',
  vacancy_pct: 'fsVacancy',
  opex_pct: 'fsOpex',
  target_cap_rate_pct: 'fsTargetCap',
  target_cost_per_sqft: 'fsTargetCost',
  weight_cap_rate: 'fsWeightCap',
  weight_cost: 'fsWeightCost',
  weight_density: 'fsWeightDensity',
};

function openFinderSettings() {
  if (finderSettings) {
    Object.entries(FINDER_SETTINGS_FIELD_IDS).forEach(([field, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = finderSettings[field];
    });
  }
  finderSettingsError.style.display = 'none';
  finderSettingsModal.hidden = false;
}

if (finderSettingsBtn) {
  finderSettingsBtn.addEventListener('click', async () => {
    if (!finderSettings) {
      try {
        const res = await fetch('/api/finder-settings');
        const data = await res.json();
        finderSettings = data.settings;
      } catch {
        // fall through with no cached settings; form will just show blanks
      }
    }
    openFinderSettings();
  });
}
if (finderSettingsCancel) finderSettingsCancel.addEventListener('click', () => { finderSettingsModal.hidden = true; });
if (finderSettingsModal) {
  finderSettingsModal.addEventListener('click', (e) => {
    if (e.target === finderSettingsModal) finderSettingsModal.hidden = true;
  });
}

if (finderSettingsForm) {
  finderSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    finderSettingsError.style.display = 'none';

    const payload = {};
    for (const [field, id] of Object.entries(FINDER_SETTINGS_FIELD_IDS)) {
      payload[field] = Number(document.getElementById(id).value);
    }

    const submitBtn = finderSettingsForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/finder-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        finderSettings = data.settings;
        finderSettingsModal.hidden = true;
      } else {
        finderSettingsError.textContent = data.error || 'Something went wrong.';
        finderSettingsError.style.display = 'block';
      }
    } catch {
      finderSettingsError.textContent = 'Something went wrong. Please try again.';
      finderSettingsError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---- Initial page ------------------------------------------- */
const initialPage = validPages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'action-items';
showPage(initialPage);

});
