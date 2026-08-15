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
}

navLeaves.forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

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

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, na: 3 };

const actionItemsListEl = document.getElementById('actionItemsList');
const actionItemsForm = document.getElementById('actionItemsForm');
const actionItemsSortBtns = document.querySelectorAll('.action-items-sort-btn');

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
  const tasks = [...actionItems];
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
    actionItemsListEl.innerHTML = '<li class="action-items-empty">No tasks yet — add one above.</li>';
    return;
  }
  actionItemsListEl.innerHTML = tasks
    .map(
      (t) => `
    <li class="action-items-row" data-id="${t.id}">
      <div class="action-items-row-main">
        <span class="action-items-priority-dot action-items-priority-dot--${t.priority}"></span>
        <span class="action-items-row-name">${escapeHtml(t.name)}</span>
      </div>
      <div class="action-items-row-meta">
        <span class="action-items-row-owner">${escapeHtml(t.owner)}</span>
        <span class="action-items-row-due ${isOverdue(t.due_date) ? 'is-overdue' : ''}">${formatShortDate(t.due_date)}</span>
        <button type="button" class="action-items-row-remove" aria-label="Remove task" data-id="${t.id}">&times;</button>
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

if (actionItemsForm) {
  actionItemsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('actionItemName').value.trim();
    const priority = document.getElementById('actionItemPriority').value;
    const owner = document.getElementById('actionItemOwner').value;
    const dueDate = document.getElementById('actionItemDueDate').value || null;
    if (!name) return;

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
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (actionItemsListEl) {
  actionItemsListEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-items-row-remove');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const row = btn.closest('.action-items-row');
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
        return `<div class="cal-event-bar" style="left:${left}%;width:calc(${width}% - 4px);top:${top}px" title="${escapeHtml(item.ev.name)}">${escapeHtml(item.ev.name)}</div>`;
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
      <span class="cal-summary-swatch"></span>
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

/* ---- Initial page ------------------------------------------- */
const initialPage = validPages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'action-items';
showPage(initialPage);

});
