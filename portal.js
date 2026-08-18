/* ============================================================
   FORTERA HOMES — Management Portal
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- Rich text editor (Discussion / Notes & Discussion fields) ----
   A small contenteditable-based editor: Bold/Italic/Underline/bullet
   list/font size via document.execCommand, paste forced to plain text
   to keep the produced markup predictable, and a DOM-walking sanitizer
   that only allows the tags/attributes the toolbar can actually
   produce — run on every load of saved HTML back into the page,
   whether editable or read-only. */
const RICH_HTML_ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'DIV', 'SPAN', 'P', 'FONT']);

function sanitizeRichHtml(html) {
  if (!html) return '';
  // Parse into a fully inert document (no browsing context) rather than a
  // live <div> — a live element starts loading resources and can fire
  // inline handlers like onerror/onload the instant innerHTML is parsed,
  // before this function ever gets to strip them. An inert document has
  // no window to run scripts or fetch resources in, so parsing here can't
  // execute anything no matter what the input contains.
  const container = document.implementation.createHTMLDocument('').body;
  container.innerHTML = html;

  function walk(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!RICH_HTML_ALLOWED_TAGS.has(child.tagName)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        Array.from(child.attributes).forEach((attr) => {
          if (child.tagName === 'FONT' && attr.name === 'size') {
            if (!/^[1-7]$/.test(attr.value)) child.removeAttribute('size');
          } else if (child.tagName === 'SPAN' && attr.name === 'style') {
            const match = attr.value.match(/font-size:\s*[\w.%-]+/i);
            if (match) child.setAttribute('style', match[0]);
            else child.removeAttribute('style');
          } else {
            child.removeAttribute(attr.name);
          }
        });
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  }

  walk(container);
  return container.innerHTML;
}

// Discussion notes are jotted live during a meeting, so that field is a
// plain textarea rather than the rich editor. This degrades any
// HTML saved before that change into readable plain text.
function richHtmlToPlainText(html) {
  if (!html) return '';
  const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);
  const container = document.implementation.createHTMLDocument('').body;
  container.innerHTML = html;

  function walk(node) {
    let text = '';
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          text += '\n';
        } else {
          text += walk(child);
          if (BLOCK_TAGS.has(child.tagName)) text += '\n';
        }
      }
    });
    return text;
  }

  return walk(container).replace(/\n{3,}/g, '\n\n').trim();
}

function initRichEditor(toolbarEl, editorEl) {
  if (!toolbarEl || !editorEl) return;

  function updateToolbarState() {
    toolbarEl.querySelectorAll('[data-cmd]').forEach((btn) => {
      try {
        btn.classList.toggle('is-active', document.queryCommandState(btn.dataset.cmd));
      } catch {
        // command state not queryable in this browser; leave as-is
      }
    });
  }

  toolbarEl.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      editorEl.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));
      updateToolbarState();
    });
  });

  const fontSizeSelect = toolbarEl.querySelector('.rich-editor-fontsize');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('mousedown', (e) => e.stopPropagation());
    fontSizeSelect.addEventListener('change', () => {
      if (!fontSizeSelect.value) return;
      editorEl.focus();
      document.execCommand('fontSize', false, fontSizeSelect.value);
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));
      fontSizeSelect.value = '';
    });
  }

  editorEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  editorEl.addEventListener('keyup', updateToolbarState);
  editorEl.addEventListener('mouseup', updateToolbarState);
  editorEl.addEventListener('focus', updateToolbarState);
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
  if (pageKey === 'meetings' && !meetingsLoaded) loadMeetings();
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
const actionItemsNavBadge = document.getElementById('actionItemsNavBadge');
const actionItemsForm = document.getElementById('actionItemsForm');
const actionItemsSortBtns = document.querySelectorAll('.action-items-sort-btn[data-sort]');
const actionItemsTabBtns = document.querySelectorAll('.action-items-sort-btn[data-tab]');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmCancel = document.getElementById('deleteConfirmCancel');
const deleteConfirmConfirm = document.getElementById('deleteConfirmConfirm');

/* ---- Owner multi-select (reused by the add form and edit modal) --- */
function initOwnerMultiselect(fieldEl, triggerEl, labelEl, panelEl, placeholder = 'Assign to', onChange) {
  const checkboxes = panelEl ? Array.from(panelEl.querySelectorAll('input[type="checkbox"]')) : [];
  const allCheckbox = panelEl ? panelEl.querySelector('input[value="All"]') : null;

  function updateLabel() {
    const selected = checkboxes.filter((cb) => cb.checked && cb.value !== 'All').map((cb) => cb.value);
    if (allCheckbox && allCheckbox.checked) {
      labelEl.textContent = 'All';
    } else if (selected.length) {
      labelEl.textContent = selected.join(', ');
    } else {
      labelEl.textContent = placeholder;
    }
  }

  function getValue() {
    if (allCheckbox && allCheckbox.checked) return 'All';
    return checkboxes
      .filter((cb) => cb.checked && cb.value !== 'All')
      .map((cb) => cb.value)
      .join(', ');
  }

  function setValue(owner) {
    const parts = owner === 'All' ? ['All'] : owner ? owner.split(', ') : [];
    checkboxes.forEach((cb) => { cb.checked = parts.includes(cb.value); });
    updateLabel();
  }

  function reset() {
    checkboxes.forEach((cb) => { cb.checked = false; });
    updateLabel();
  }

  function close() {
    if (!panelEl || panelEl.hidden) return;
    panelEl.hidden = true;
    triggerEl.setAttribute('aria-expanded', 'false');
  }

  if (triggerEl && panelEl) {
    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !panelEl.hidden;
      panelEl.hidden = isOpen;
      triggerEl.setAttribute('aria-expanded', String(!isOpen));
    });

    checkboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.value === 'All' && cb.checked) {
          checkboxes.forEach((other) => { if (other !== cb) other.checked = false; });
        } else if (cb.checked && allCheckbox) {
          allCheckbox.checked = false;
        }
        updateLabel();
        if (onChange) onChange();
      });
    });

    document.addEventListener('click', (e) => {
      if (!fieldEl.contains(e.target)) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  return { updateLabel, getValue, setValue, reset, close };
}

const ownerSelect = initOwnerMultiselect(
  document.getElementById('actionItemOwnerField'),
  document.getElementById('actionItemOwnerTrigger'),
  document.getElementById('actionItemOwnerLabel'),
  document.getElementById('actionItemOwnerPanel')
);

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

function updateActionItemsBadge() {
  if (!actionItemsNavBadge) return;
  const active = actionItems.filter((t) => !t.completed).length;
  actionItemsNavBadge.hidden = active === 0;
  actionItemsNavBadge.textContent = active > 99 ? '99+' : String(active);
}

function renderActionItems() {
  updateActionItemsBadge();
  renderHomeDashboard();
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
    const owner = ownerSelect.getValue();
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
        ownerSelect.reset();
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
      return;
    }

    const row = e.target.closest('.action-items-row');
    if (row) openEditItemModal(Number(row.dataset.id));
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

/* ---- Edit task modal ------------------------------------------ */
let editingItemId = null;

const editItemModal = document.getElementById('editItemModal');
const editItemForm = document.getElementById('editItemForm');
const editItemTaskName = document.getElementById('editItemTaskName');
const editItemPriority = document.getElementById('editItemPriority');
const editItemDueDate = document.getElementById('editItemDueDate');
const editItemCancel = document.getElementById('editItemCancel');
const editItemError = document.getElementById('editItemError');

const editItemOwnerSelect = initOwnerMultiselect(
  document.getElementById('editItemOwnerField'),
  document.getElementById('editItemOwnerTrigger'),
  document.getElementById('editItemOwnerLabel'),
  document.getElementById('editItemOwnerPanel')
);

function openEditItemModal(id) {
  const task = actionItems.find((t) => t.id === id);
  if (!task || !editItemModal) return;
  editingItemId = id;
  editItemTaskName.textContent = task.name;
  editItemPriority.value = task.priority;
  editItemOwnerSelect.setValue(task.owner);
  editItemDueDate.value = task.due_date || '';
  editItemError.style.display = 'none';
  editItemModal.hidden = false;
}

function closeEditItemModal() {
  if (editItemModal) editItemModal.hidden = true;
  editingItemId = null;
}

if (editItemCancel) editItemCancel.addEventListener('click', closeEditItemModal);
if (editItemModal) {
  editItemModal.addEventListener('click', (e) => {
    if (e.target === editItemModal) closeEditItemModal();
  });
}

if (editItemForm) {
  editItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editingItemId === null) return;

    const priority = editItemPriority.value;
    const owner = editItemOwnerSelect.getValue();
    const dueDate = editItemDueDate.value || null;
    editItemError.style.display = 'none';

    if (!owner) {
      editItemError.textContent = 'Select at least one assignee.';
      editItemError.style.display = 'block';
      return;
    }

    const submitBtn = editItemForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch(`/api/tasks/${editingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority, owner, dueDate }),
      });
      if (res.ok) {
        const data = await res.json();
        const idx = actionItems.findIndex((t) => t.id === editingItemId);
        if (idx !== -1) actionItems[idx] = data.task;
        renderActionItems();
        closeEditItemModal();
      } else {
        editItemError.textContent = 'Something went wrong. Please try again.';
        editItemError.style.display = 'block';
      }
    } catch {
      editItemError.textContent = 'Something went wrong. Please try again.';
      editItemError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
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
  renderHomeDashboard();
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
   TEAM MEETINGS
   ================================================================ */
let meetingsLoaded = false;
let activeMeeting = null;
let draftMeetings = [];
let archivedMeetings = [];
let editingTopicMeeting = null;
let editingTopicId = null;
let viewingMeeting = null;
let pendingDeleteMeetingId = null;
let pendingDeleteFrom = null; // 'draft' | 'archive'
let archiveListPage = 0;
let archiveViewMode = 'list'; // 'list' | 'detail'
const ARCHIVE_PAGE_SIZE = 10;
const archiveDetailCache = new Map();
let isPresenting = false;
let presentIndex = 0;
let presentSlides = [];

const meetingArchiveBtn = document.getElementById('meetingArchiveBtn');
const meetingNewDraftBtn = document.getElementById('meetingNewDraftBtn');
const meetingActiveEl = document.getElementById('meetingActive');
const meetingActiveHeader = document.getElementById('meetingActiveHeader');
const meetingActiveDate = document.getElementById('meetingActiveDate');
const meetingEndBtn = document.getElementById('meetingEndBtn');
const meetingActiveTopicsList = document.getElementById('meetingActiveTopicsList');
const meetingActiveTopicForm = document.getElementById('meetingActiveTopicForm');
const meetingDraftsList = document.getElementById('meetingDraftsList');
const meetingDraftsSection = document.getElementById('meetingDraftsSection');

const meetingPresentToggleBtn = document.getElementById('meetingPresentToggleBtn');
const meetingPresentExitBtn = document.getElementById('meetingPresentExitBtn');
const meetingStopPresentingBtn = document.getElementById('meetingStopPresentingBtn');
const meetingPresentEndBtn = document.getElementById('meetingPresentEndBtn');
const meetingPrepView = document.getElementById('meetingPrepView');
const meetingPresentView = document.getElementById('meetingPresentView');
const meetingPresentPagerLabel = document.getElementById('meetingPresentPagerLabel');
const meetingPresentPrevBtn = document.getElementById('meetingPresentPrevBtn');
const meetingPresentNextBtn = document.getElementById('meetingPresentNextBtn');

const meetingSlideWelcome = document.getElementById('meetingSlideWelcome');
const meetingSlideWelcomeBody = document.getElementById('meetingSlideWelcomeBody');
const meetingSlideSegue = document.getElementById('meetingSlideSegue');
const meetingSlideSegueTitle = document.getElementById('meetingSlideSegueTitle');
const meetingSlideSegueBody = document.getElementById('meetingSlideSegueBody');
const meetingSlideSegueHint = document.getElementById('meetingSlideSegueHint');
const meetingSlideSegueQuickAdd = document.getElementById('meetingSlideSegueQuickAdd');
const meetingSlideTopic = document.getElementById('meetingSlideTopic');
const meetingPresentTitle = document.getElementById('meetingPresentTitle');
const meetingPresentContentText = document.getElementById('meetingPresentContentText');
const meetingPresentDiscussion = document.getElementById('meetingPresentDiscussion');
const meetingPresentDiscussionSaveBtn = document.getElementById('meetingPresentDiscussionSaveBtn');
const meetingSlideComplete = document.getElementById('meetingSlideComplete');

initRichEditor(document.getElementById('meetingActiveTopicContentToolbar'), document.querySelector('#meetingActiveTopicForm .meeting-topic-content-input'));
initRichEditor(document.getElementById('meetingTopicEditContentToolbar'), document.getElementById('meetingTopicEditContent'));

const meetingQuickTaskToggleBtn = document.getElementById('meetingQuickTaskToggleBtn');
const meetingQuickTaskForm = document.getElementById('meetingQuickTaskForm');
const meetingQuickTaskName = document.getElementById('meetingQuickTaskName');
const meetingQuickTaskPriority = document.getElementById('meetingQuickTaskPriority');
const meetingQuickTaskDueDate = document.getElementById('meetingQuickTaskDueDate');
const meetingQuickTaskSuccess = document.getElementById('meetingQuickTaskSuccess');

const meetingQuickTaskOwnerSelect = initOwnerMultiselect(
  document.getElementById('meetingQuickTaskOwnerField'),
  document.getElementById('meetingQuickTaskOwnerTrigger'),
  document.getElementById('meetingQuickTaskOwnerLabel'),
  document.getElementById('meetingQuickTaskOwnerPanel')
);
const meetingArchiveFrom = document.getElementById('meetingArchiveFrom');
const meetingArchiveTo = document.getElementById('meetingArchiveTo');
const meetingArchiveClearBtn = document.getElementById('meetingArchiveClearBtn');
const meetingArchiveEmpty = document.getElementById('meetingArchiveEmpty');
const meetingArchiveListView = document.getElementById('meetingArchiveListView');
const meetingArchiveListEl = document.getElementById('meetingArchiveListEl');
const meetingArchiveListPrevBtn = document.getElementById('meetingArchiveListPrevBtn');
const meetingArchiveListNextBtn = document.getElementById('meetingArchiveListNextBtn');
const meetingArchiveListPagerLabel = document.getElementById('meetingArchiveListPagerLabel');
const meetingArchiveDetailView = document.getElementById('meetingArchiveDetailView');
const meetingArchiveBackBtn = document.getElementById('meetingArchiveBackBtn');

const meetingTopicEditModal = document.getElementById('meetingTopicEditModal');
const meetingTopicEditForm = document.getElementById('meetingTopicEditForm');
const meetingTopicEditTitle = document.getElementById('meetingTopicEditTitle');
const meetingTopicEditContent = document.getElementById('meetingTopicEditContent');
const meetingTopicEditCancel = document.getElementById('meetingTopicEditCancel');
const meetingTopicEditError = document.getElementById('meetingTopicEditError');

const meetingEndConfirmModal = document.getElementById('meetingEndConfirmModal');
const meetingEndConfirmCancel = document.getElementById('meetingEndConfirmCancel');
const meetingEndConfirmConfirm = document.getElementById('meetingEndConfirmConfirm');

const meetingDeleteConfirmModal = document.getElementById('meetingDeleteConfirmModal');
const meetingDeleteConfirmCancel = document.getElementById('meetingDeleteConfirmCancel');
const meetingDeleteConfirmConfirm = document.getElementById('meetingDeleteConfirmConfirm');

const meetingArchiveModal = document.getElementById('meetingArchiveModal');
const meetingViewDate = document.getElementById('meetingViewDate');
const meetingViewAttendees = document.getElementById('meetingViewAttendees');
const meetingViewTopics = document.getElementById('meetingViewTopics');
const meetingViewClose = document.getElementById('meetingViewClose');
const meetingViewDeleteBtn = document.getElementById('meetingViewDeleteBtn');

const meetingAttendeesSelect = initOwnerMultiselect(
  document.getElementById('meetingAttendeesField'),
  document.getElementById('meetingAttendeesTrigger'),
  document.getElementById('meetingAttendeesLabel'),
  document.getElementById('meetingAttendeesPanel'),
  'Who attended?',
  saveMeetingAttendees
);

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMeetingDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

async function loadMeetings() {
  meetingsLoaded = true;
  try {
    const [openRes, draftRes, endedRes] = await Promise.all([
      fetch('/api/meetings?property=beechwood&status=open'),
      fetch('/api/meetings?property=beechwood&status=draft'),
      fetch('/api/meetings?property=beechwood&status=ended'),
    ]);
    const openData = await openRes.json();
    const draftData = await draftRes.json();
    const endedData = await endedRes.json();
    activeMeeting = (openData.meetings || [])[0] || null;
    draftMeetings = draftData.meetings || [];
    archivedMeetings = endedData.meetings || [];
  } catch {
    activeMeeting = null;
    draftMeetings = [];
    archivedMeetings = [];
  }
  renderMeetings();
}

function renderMeetings() {
  meetingActiveEl.hidden = !activeMeeting;
  if (activeMeeting) {
    meetingActiveDate.textContent = formatMeetingDate(activeMeeting.meeting_date);
    meetingAttendeesSelect.setValue(activeMeeting.attendees);
    renderActiveTopics();
    if (isPresenting) renderPresentSlide();
  } else {
    isPresenting = false;
    meetingActiveHeader.hidden = false;
    meetingPrepView.hidden = false;
    meetingPresentView.hidden = true;
  }
  meetingDraftsSection.hidden = isPresenting;
  renderDrafts();
}

function renderTopicsInto(listEl, topics, { editable }) {
  if (!topics || !topics.length) {
    listEl.innerHTML = editable ? '' : '<li class="action-items-empty">No topics recorded.</li>';
    return;
  }
  listEl.innerHTML = topics
    .map(
      (t, i) => `
    <li class="meeting-topic-row" data-id="${t.id}">
      <span class="meeting-topic-row-num">${i + 1}</span>
      <div class="meeting-topic-row-main">
        <div class="meeting-topic-row-title">${escapeHtml(t.title)}</div>
        ${t.content ? `<div class="meeting-topic-row-content">${sanitizeRichHtml(t.content)}</div>` : ''}
        ${t.discussion ? `<div class="meeting-topic-row-discussion"><strong>Discussion:</strong> ${escapeHtml(richHtmlToPlainText(t.discussion))}</div>` : ''}
      </div>
      ${
        editable
          ? `<div class="meeting-topic-row-actions">
        <button type="button" class="meeting-topic-row-edit" aria-label="Edit topic" data-id="${t.id}">&#9998;</button>
        <button type="button" class="meeting-topic-row-delete" aria-label="Delete topic" data-id="${t.id}">&times;</button>
      </div>`
          : ''
      }
    </li>`
    )
    .join('');
}

function renderActiveTopics() {
  renderTopicsInto(meetingActiveTopicsList, activeMeeting.topics, { editable: true });
}

function renderDraftMeta(meeting) {
  const card = meetingDraftsList.querySelector(`.meeting-draft-card[data-id="${meeting.id}"]`);
  if (!card) return;
  const countEl = card.querySelector('.meeting-draft-topic-count');
  if (countEl) countEl.textContent = `${meeting.topics.length} topic${meeting.topics.length === 1 ? '' : 's'}`;
  const listEl = card.querySelector('.meeting-topics-list');
  if (listEl) renderTopicsInto(listEl, meeting.topics, { editable: true });
}

function renderDrafts() {
  if (!draftMeetings.length) {
    meetingDraftsList.innerHTML = '<div class="meeting-empty">No drafts queued — start prepping next week’s meeting above.</div>';
    return;
  }
  meetingDraftsList.innerHTML = draftMeetings
    .map(
      (m) => `
    <div class="meeting-draft-card" data-id="${m.id}">
      <div class="meeting-draft-header">
        <input class="portal-field-input meeting-draft-date" type="date" value="${m.meeting_date}" data-id="${m.id}">
        <span class="meeting-draft-topic-count">${m.topics.length} topic${m.topics.length === 1 ? '' : 's'}</span>
        <div class="meeting-draft-actions">
          <button type="button" class="portal-btn meeting-draft-start" data-id="${m.id}" ${activeMeeting ? 'disabled' : ''}>Start Meeting</button>
          <button type="button" class="meeting-draft-delete" aria-label="Delete draft" data-id="${m.id}">&times;</button>
        </div>
      </div>
      <ul class="meeting-topics-list" data-meeting-id="${m.id}"></ul>
      <form class="meeting-topic-add-form" data-meeting-id="${m.id}" novalidate>
        <input class="portal-field-input" type="text" name="title" placeholder="Topic title" maxlength="200" required>
        <div class="rich-editor-toolbar meeting-topic-content-toolbar">
          <button type="button" class="rich-editor-btn" data-cmd="bold" aria-label="Bold"><b>B</b></button>
          <button type="button" class="rich-editor-btn" data-cmd="italic" aria-label="Italic"><i>I</i></button>
          <button type="button" class="rich-editor-btn" data-cmd="underline" aria-label="Underline"><u>U</u></button>
          <button type="button" class="rich-editor-btn rich-editor-btn--list" data-cmd="insertUnorderedList">&#8226; List</button>
          <select class="rich-editor-fontsize" aria-label="Font size">
            <option value="">Size</option>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
          </select>
        </div>
        <div class="rich-editor rich-editor--compact meeting-topic-content-input" contenteditable="true" data-placeholder="Notes for this topic (optional)"></div>
        <button type="submit" class="portal-btn">+ Add Topic</button>
      </form>
    </div>`
    )
    .join('');

  draftMeetings.forEach((m) => {
    const listEl = meetingDraftsList.querySelector(`.meeting-topics-list[data-meeting-id="${m.id}"]`);
    if (listEl) renderTopicsInto(listEl, m.topics, { editable: true });
    const form = meetingDraftsList.querySelector(`.meeting-topic-add-form[data-meeting-id="${m.id}"]`);
    if (form) initRichEditor(form.querySelector('.meeting-topic-content-toolbar'), form.querySelector('.meeting-topic-content-input'));
  });
}

function archiveDateFilter() {
  const from = meetingArchiveFrom.value;
  const to = meetingArchiveTo.value;
  return archivedMeetings.filter((m) => {
    if (from && m.meeting_date < from) return false;
    if (to && m.meeting_date > to) return false;
    return true;
  });
}

function openArchiveModal() {
  archiveListPage = 0;
  archiveViewMode = 'list';
  meetingArchiveModal.hidden = false;
  renderArchiveList();
}

function renderArchiveList() {
  archiveViewMode = 'list';
  viewingMeeting = null;
  const filtered = archiveDateFilter();

  if (!filtered.length) {
    meetingArchiveEmpty.hidden = false;
    meetingArchiveEmpty.textContent = archivedMeetings.length ? 'No meetings match that date range.' : 'No past meetings yet.';
    meetingArchiveListView.hidden = true;
    meetingArchiveDetailView.hidden = true;
    meetingViewDeleteBtn.hidden = true;
    return;
  }

  meetingArchiveEmpty.hidden = true;
  meetingArchiveDetailView.hidden = true;
  meetingArchiveListView.hidden = false;
  meetingViewDeleteBtn.hidden = true;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ARCHIVE_PAGE_SIZE));
  archiveListPage = Math.min(Math.max(archiveListPage, 0), totalPages - 1);
  const pageItems = filtered.slice(archiveListPage * ARCHIVE_PAGE_SIZE, (archiveListPage + 1) * ARCHIVE_PAGE_SIZE);

  meetingArchiveListEl.innerHTML = pageItems
    .map(
      (m) => `
    <li class="meeting-archive-row">
      <button type="button" class="meeting-archive-row-btn" data-id="${m.id}">
        <span class="meeting-archive-row-date">${formatMeetingDate(m.meeting_date)}</span>
        <span class="meeting-archive-row-count">${m.topic_count} topic${m.topic_count === 1 ? '' : 's'}</span>
      </button>
    </li>`
    )
    .join('');

  meetingArchiveListPagerLabel.textContent = `Page ${archiveListPage + 1} of ${totalPages}`;
  meetingArchiveListPrevBtn.disabled = archiveListPage === 0;
  meetingArchiveListNextBtn.disabled = archiveListPage === totalPages - 1;
}

async function openArchiveDetail(id) {
  archiveViewMode = 'detail';
  meetingArchiveListView.hidden = true;
  meetingArchiveDetailView.hidden = false;
  meetingViewDeleteBtn.hidden = false;

  let detail = archiveDetailCache.get(id);
  if (!detail) {
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (res.ok) {
        const data = await res.json();
        detail = data.meeting;
        archiveDetailCache.set(id, detail);
      }
    } catch {
      // leave the list showing; user can retry by clicking the row again
    }
  }
  if (detail) fillArchiveModalContent(detail);
}

function fillArchiveModalContent(meeting) {
  viewingMeeting = meeting;
  meetingViewDate.textContent = formatMeetingDate(meeting.meeting_date);
  meetingViewAttendees.innerHTML = meeting.attendees
    ? ownerTagsHtml(meeting.attendees)
    : '<span class="meeting-archive-row-attendees">No attendance recorded</span>';
  renderTopicsInto(meetingViewTopics, meeting.topics, { editable: false });
}

/* ---- Start a new draft ----------------------------------------- */
if (meetingNewDraftBtn) {
  meetingNewDraftBtn.addEventListener('click', async () => {
    meetingNewDraftBtn.disabled = true;
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate: todayDateStr(), property: 'beechwood' }),
      });
      if (res.ok) {
        const data = await res.json();
        draftMeetings.unshift(data.meeting);
        renderDrafts();
      }
    } finally {
      meetingNewDraftBtn.disabled = false;
    }
  });
}

/* ---- Attendance (in-progress meeting only) --------------------- */
async function saveMeetingAttendees() {
  if (!activeMeeting) return;
  const attendees = meetingAttendeesSelect.getValue();
  try {
    const res = await fetch(`/api/meetings/${activeMeeting.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees }),
    });
    if (res.ok) {
      const data = await res.json();
      activeMeeting.attendees = data.meeting.attendees;
    }
  } catch {
    // leave selection as-is; user can retoggle to retry
  }
}

/* ---- Present mode: a fixed slide deck you swipe through ----------- */
const SEGUE_SLIDES = [
  {
    type: 'segue',
    title: 'Action Items',
    body: "Let's review our action items.",
    hint: 'Switch to the Action Items tab to go through them together.',
    quickAdd: true,
  },
  {
    type: 'segue',
    title: 'Calendar',
    body: "Let's review the calendar.",
    hint: 'Switch to the Calendar tab to walk through key dates.',
  },
  {
    type: 'segue',
    title: 'Topics',
    body: "Now, let's get into today's topics.",
    hint: '',
  },
];

function buildPresentSlides() {
  const topics = (activeMeeting && activeMeeting.topics) || [];
  const slides = [{ type: 'welcome' }, ...SEGUE_SLIDES];
  topics.forEach((t) => slides.push({ type: 'topic', topicId: t.id }));
  slides.push({ type: 'complete' });
  return slides;
}

function enterPresentMode() {
  if (!activeMeeting) return;
  isPresenting = true;
  presentSlides = buildPresentSlides();
  presentIndex = 0;
  meetingActiveHeader.hidden = true;
  meetingPrepView.hidden = true;
  meetingPresentView.hidden = false;
  meetingDraftsSection.hidden = true;
  renderPresentSlide();
}

function exitPresentMode() {
  isPresenting = false;
  meetingActiveHeader.hidden = false;
  meetingPrepView.hidden = false;
  meetingPresentView.hidden = true;
  meetingDraftsSection.hidden = false;
}

if (meetingPresentToggleBtn) meetingPresentToggleBtn.addEventListener('click', enterPresentMode);
if (meetingPresentExitBtn) meetingPresentExitBtn.addEventListener('click', exitPresentMode);
if (meetingStopPresentingBtn) meetingStopPresentingBtn.addEventListener('click', exitPresentMode);

document.addEventListener('keydown', (e) => {
  if (!isPresenting) return;
  if (e.key === 'Escape') {
    exitPresentMode();
  } else if (e.key === 'ArrowLeft' && !meetingPresentPrevBtn.disabled) {
    meetingPresentPrevBtn.click();
  } else if (e.key === 'ArrowRight' && !meetingPresentNextBtn.disabled) {
    meetingPresentNextBtn.click();
  }
});

function renderPresentSlide() {
  meetingSlideWelcome.hidden = true;
  meetingSlideSegue.hidden = true;
  meetingSlideTopic.hidden = true;
  meetingSlideComplete.hidden = true;

  const slide = presentSlides[presentIndex];
  meetingPresentPagerLabel.textContent = presentSlides.length ? `${presentIndex + 1} of ${presentSlides.length}` : '';
  meetingPresentPrevBtn.disabled = presentIndex === 0;
  meetingPresentNextBtn.disabled = presentIndex === presentSlides.length - 1;

  if (!slide) return;

  if (slide.type === 'welcome') {
    meetingSlideWelcome.hidden = false;
    const attendeeNames = activeMeeting.attendees ? activeMeeting.attendees.split(', ') : [];
    meetingSlideWelcomeBody.innerHTML = attendeeNames.length
      ? attendeeNames.map((n) => `<span class="meeting-welcome-chip">${escapeHtml(n)}</span>`).join('')
      : '<p class="meeting-present-slide-body">No attendance recorded yet.</p>';
  } else if (slide.type === 'segue') {
    meetingSlideSegue.hidden = false;
    meetingSlideSegueTitle.textContent = slide.title;
    meetingSlideSegueBody.textContent = slide.body;
    meetingSlideSegueHint.textContent = slide.hint || '';
    meetingSlideSegueQuickAdd.hidden = !slide.quickAdd;
  } else if (slide.type === 'topic') {
    const topic = activeMeeting.topics.find((t) => t.id === slide.topicId);
    if (!topic) return;
    meetingSlideTopic.hidden = false;
    meetingPresentTitle.textContent = topic.title;
    meetingPresentContentText.innerHTML = sanitizeRichHtml(topic.content);
    meetingPresentDiscussion.value = richHtmlToPlainText(topic.discussion);
    meetingPresentDiscussionSaveBtn.disabled = true;
  } else if (slide.type === 'complete') {
    meetingSlideComplete.hidden = false;
  }
}

if (meetingPresentPrevBtn) {
  meetingPresentPrevBtn.addEventListener('click', () => {
    presentIndex -= 1;
    renderPresentSlide();
  });
}
if (meetingPresentNextBtn) {
  meetingPresentNextBtn.addEventListener('click', () => {
    presentIndex += 1;
    renderPresentSlide();
  });
}

if (meetingPresentDiscussion) {
  meetingPresentDiscussion.addEventListener('input', () => {
    meetingPresentDiscussionSaveBtn.disabled = false;
  });
}
if (meetingPresentDiscussionSaveBtn) {
  meetingPresentDiscussionSaveBtn.addEventListener('click', async () => {
    const slide = presentSlides[presentIndex];
    if (!activeMeeting || !slide || slide.type !== 'topic') return;
    const topic = activeMeeting.topics.find((t) => t.id === slide.topicId);
    if (!topic) return;
    meetingPresentDiscussionSaveBtn.disabled = true;
    try {
      const res = await fetch(`/api/meetings/${activeMeeting.id}/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discussion: meetingPresentDiscussion.value }),
      });
      if (res.ok) {
        const data = await res.json();
        const idx = activeMeeting.topics.findIndex((t) => t.id === topic.id);
        if (idx !== -1) activeMeeting.topics[idx] = data.topic;
        renderActiveTopics();
      } else {
        meetingPresentDiscussionSaveBtn.disabled = false;
      }
    } catch {
      meetingPresentDiscussionSaveBtn.disabled = false;
    }
  });
}

/* ---- Quick-add an action item straight from presenting ------------ */
if (meetingQuickTaskToggleBtn) {
  meetingQuickTaskToggleBtn.addEventListener('click', () => {
    const opening = meetingQuickTaskForm.hidden;
    meetingQuickTaskForm.hidden = !opening;
    meetingQuickTaskToggleBtn.textContent = opening ? 'Cancel' : '+ Add Action Item';
    meetingQuickTaskSuccess.hidden = true;
    if (opening) meetingQuickTaskName.focus();
  });
}

if (meetingQuickTaskForm) {
  meetingQuickTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = meetingQuickTaskName.value.trim();
    const priority = meetingQuickTaskPriority.value;
    const owner = meetingQuickTaskOwnerSelect.getValue();
    const dueDate = meetingQuickTaskDueDate.value || null;
    if (!name || !owner) return;

    const submitBtn = meetingQuickTaskForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, priority, owner, dueDate, property: 'beechwood' }),
      });
      if (res.ok) {
        meetingQuickTaskForm.reset();
        meetingQuickTaskOwnerSelect.reset();
        meetingQuickTaskForm.hidden = true;
        meetingQuickTaskToggleBtn.textContent = '+ Add Action Item';
        meetingQuickTaskSuccess.hidden = false;
        actionItemsLoaded = false;
        setTimeout(() => {
          meetingQuickTaskSuccess.hidden = true;
        }, 3000);
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---- Topics: shared add/delete helpers -------------------------- */
async function addTopic(meeting, formEl, onDone) {
  const title = formEl.elements.title.value.trim();
  const contentEditor = formEl.querySelector('.meeting-topic-content-input');
  const content = contentEditor ? contentEditor.innerHTML.trim() : '';
  if (!title) return;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch(`/api/meetings/${meeting.id}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      const data = await res.json();
      meeting.topics.push(data.topic);
      formEl.reset();
      if (contentEditor) contentEditor.innerHTML = '';
      onDone();
    }
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteTopic(meeting, topicId, onDone) {
  try {
    const res = await fetch(`/api/meetings/${meeting.id}/topics/${topicId}`, { method: 'DELETE' });
    if (res.ok) {
      meeting.topics = meeting.topics.filter((t) => t.id !== topicId);
      onDone();
    }
  } catch {
    // leave as-is; user can retry
  }
}

if (meetingActiveTopicForm) {
  meetingActiveTopicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeMeeting) return;
    await addTopic(activeMeeting, meetingActiveTopicForm, renderActiveTopics);
  });
}

if (meetingActiveTopicsList) {
  meetingActiveTopicsList.addEventListener('click', async (e) => {
    if (!activeMeeting) return;
    const editBtn = e.target.closest('.meeting-topic-row-edit');
    if (editBtn) {
      openTopicEditModal(activeMeeting, Number(editBtn.dataset.id));
      return;
    }
    const deleteBtn = e.target.closest('.meeting-topic-row-delete');
    if (deleteBtn) await deleteTopic(activeMeeting, Number(deleteBtn.dataset.id), renderActiveTopics);
  });
}

/* ---- Drafts: delegated add/edit/delete/start/date-edit ---------- */
if (meetingDraftsList) {
  meetingDraftsList.addEventListener('submit', async (e) => {
    const form = e.target.closest('.meeting-topic-add-form');
    if (!form) return;
    e.preventDefault();
    const meeting = draftMeetings.find((m) => m.id === Number(form.dataset.meetingId));
    if (!meeting) return;
    await addTopic(meeting, form, () => renderDraftMeta(meeting));
  });

  meetingDraftsList.addEventListener('click', async (e) => {
    const startBtn = e.target.closest('.meeting-draft-start');
    if (startBtn) {
      await startDraftMeeting(Number(startBtn.dataset.id));
      return;
    }
    const draftDeleteBtn = e.target.closest('.meeting-draft-delete');
    if (draftDeleteBtn) {
      pendingDeleteMeetingId = Number(draftDeleteBtn.dataset.id);
      pendingDeleteFrom = 'draft';
      meetingDeleteConfirmModal.hidden = false;
      return;
    }
    const card = e.target.closest('.meeting-draft-card');
    if (!card) return;
    const meeting = draftMeetings.find((m) => m.id === Number(card.dataset.id));
    if (!meeting) return;

    const editTopicBtn = e.target.closest('.meeting-topic-row-edit');
    if (editTopicBtn) {
      openTopicEditModal(meeting, Number(editTopicBtn.dataset.id));
      return;
    }
    const deleteTopicBtn = e.target.closest('.meeting-topic-row-delete');
    if (deleteTopicBtn) await deleteTopic(meeting, Number(deleteTopicBtn.dataset.id), () => renderDraftMeta(meeting));
  });

  meetingDraftsList.addEventListener('change', async (e) => {
    const input = e.target.closest('.meeting-draft-date');
    if (!input) return;
    const meeting = draftMeetings.find((m) => m.id === Number(input.dataset.id));
    if (!meeting) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate: input.value }),
      });
      if (res.ok) {
        const data = await res.json();
        meeting.meeting_date = data.meeting.meeting_date;
      } else {
        input.value = meeting.meeting_date;
      }
    } catch {
      input.value = meeting.meeting_date;
    }
  });
}

async function startDraftMeeting(id) {
  if (activeMeeting) return;
  try {
    const res = await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    });
    if (res.ok) await loadMeetings();
  } catch {
    // no-op; user can retry
  }
}

/* ---- Topic edit modal (shared by active + draft topics) --------- */
function openTopicEditModal(meeting, topicId) {
  const topic = meeting.topics.find((t) => t.id === topicId);
  if (!topic || !meetingTopicEditModal) return;
  editingTopicMeeting = meeting;
  editingTopicId = topicId;
  meetingTopicEditTitle.value = topic.title;
  meetingTopicEditContent.innerHTML = sanitizeRichHtml(topic.content);
  meetingTopicEditError.style.display = 'none';
  meetingTopicEditModal.hidden = false;
}

function closeTopicEditModal() {
  if (meetingTopicEditModal) meetingTopicEditModal.hidden = true;
  editingTopicMeeting = null;
  editingTopicId = null;
}

if (meetingTopicEditCancel) meetingTopicEditCancel.addEventListener('click', closeTopicEditModal);
if (meetingTopicEditModal) {
  meetingTopicEditModal.addEventListener('click', (e) => {
    if (e.target === meetingTopicEditModal) closeTopicEditModal();
  });
}

if (meetingTopicEditForm) {
  meetingTopicEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingTopicMeeting || editingTopicId === null) return;
    const title = meetingTopicEditTitle.value.trim();
    const content = meetingTopicEditContent.innerHTML.trim();
    meetingTopicEditError.style.display = 'none';

    if (!title) {
      meetingTopicEditError.textContent = 'Title is required.';
      meetingTopicEditError.style.display = 'block';
      return;
    }

    const submitBtn = meetingTopicEditForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch(`/api/meetings/${editingTopicMeeting.id}/topics/${editingTopicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) {
        const data = await res.json();
        const idx = editingTopicMeeting.topics.findIndex((t) => t.id === editingTopicId);
        if (idx !== -1) editingTopicMeeting.topics[idx] = data.topic;
        if (editingTopicMeeting === activeMeeting) {
          renderActiveTopics();
        } else {
          renderDraftMeta(editingTopicMeeting);
        }
        closeTopicEditModal();
      } else {
        meetingTopicEditError.textContent = 'Something went wrong. Please try again.';
        meetingTopicEditError.style.display = 'block';
      }
    } catch {
      meetingTopicEditError.textContent = 'Something went wrong. Please try again.';
      meetingTopicEditError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---- End meeting -------------------------------------------------- */
function openEndMeetingConfirm() {
  meetingEndConfirmModal.hidden = false;
}
if (meetingEndBtn) meetingEndBtn.addEventListener('click', openEndMeetingConfirm);
if (meetingPresentEndBtn) meetingPresentEndBtn.addEventListener('click', openEndMeetingConfirm);
if (meetingEndConfirmCancel) {
  meetingEndConfirmCancel.addEventListener('click', () => {
    meetingEndConfirmModal.hidden = true;
  });
}
if (meetingEndConfirmModal) {
  meetingEndConfirmModal.addEventListener('click', (e) => {
    if (e.target === meetingEndConfirmModal) meetingEndConfirmModal.hidden = true;
  });
}
if (meetingEndConfirmConfirm) {
  meetingEndConfirmConfirm.addEventListener('click', async () => {
    if (!activeMeeting) return;
    meetingEndConfirmConfirm.disabled = true;
    try {
      const res = await fetch(`/api/meetings/${activeMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      if (res.ok) {
        meetingEndConfirmModal.hidden = true;
        await loadMeetings();
      }
    } finally {
      meetingEndConfirmConfirm.disabled = false;
    }
  });
}

/* ---- Archive: button opens a swipe-through browser ---------------- */
if (meetingArchiveBtn) meetingArchiveBtn.addEventListener('click', openArchiveModal);

if (meetingArchiveFrom) {
  meetingArchiveFrom.addEventListener('change', () => {
    archiveListPage = 0;
    renderArchiveList();
  });
}
if (meetingArchiveTo) {
  meetingArchiveTo.addEventListener('change', () => {
    archiveListPage = 0;
    renderArchiveList();
  });
}
if (meetingArchiveClearBtn) {
  meetingArchiveClearBtn.addEventListener('click', () => {
    meetingArchiveFrom.value = '';
    meetingArchiveTo.value = '';
    archiveListPage = 0;
    renderArchiveList();
  });
}

if (meetingArchiveListPrevBtn) {
  meetingArchiveListPrevBtn.addEventListener('click', () => {
    archiveListPage -= 1;
    renderArchiveList();
  });
}
if (meetingArchiveListNextBtn) {
  meetingArchiveListNextBtn.addEventListener('click', () => {
    archiveListPage += 1;
    renderArchiveList();
  });
}
if (meetingArchiveListEl) {
  meetingArchiveListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.meeting-archive-row-btn');
    if (!btn) return;
    openArchiveDetail(Number(btn.dataset.id));
  });
}
if (meetingArchiveBackBtn) {
  meetingArchiveBackBtn.addEventListener('click', renderArchiveList);
}

function closeArchiveModal() {
  meetingArchiveModal.hidden = true;
  viewingMeeting = null;
}

if (meetingArchiveModal) {
  meetingArchiveModal.addEventListener('keydown', (e) => {
    if (archiveViewMode !== 'list') return;
    if (e.key === 'ArrowLeft' && !meetingArchiveListPrevBtn.disabled) meetingArchiveListPrevBtn.click();
    if (e.key === 'ArrowRight' && !meetingArchiveListNextBtn.disabled) meetingArchiveListNextBtn.click();
  });
  meetingArchiveModal.addEventListener('click', (e) => {
    if (e.target === meetingArchiveModal) closeArchiveModal();
  });
}
if (meetingViewClose) meetingViewClose.addEventListener('click', closeArchiveModal);

if (meetingViewDeleteBtn) {
  meetingViewDeleteBtn.addEventListener('click', () => {
    if (!viewingMeeting) return;
    pendingDeleteMeetingId = viewingMeeting.id;
    pendingDeleteFrom = 'archive';
    meetingArchiveModal.hidden = true;
    meetingDeleteConfirmModal.hidden = false;
  });
}
if (meetingDeleteConfirmCancel) {
  meetingDeleteConfirmCancel.addEventListener('click', () => {
    pendingDeleteMeetingId = null;
    pendingDeleteFrom = null;
    meetingDeleteConfirmModal.hidden = true;
  });
}
if (meetingDeleteConfirmModal) {
  meetingDeleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === meetingDeleteConfirmModal) {
      pendingDeleteMeetingId = null;
      pendingDeleteFrom = null;
      meetingDeleteConfirmModal.hidden = true;
    }
  });
}
if (meetingDeleteConfirmConfirm) {
  meetingDeleteConfirmConfirm.addEventListener('click', async () => {
    if (pendingDeleteMeetingId === null) return;
    const id = pendingDeleteMeetingId;
    const from = pendingDeleteFrom;
    meetingDeleteConfirmModal.hidden = true;
    pendingDeleteMeetingId = null;
    pendingDeleteFrom = null;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (from === 'draft') {
          draftMeetings = draftMeetings.filter((m) => m.id !== id);
          renderDrafts();
        } else {
          archivedMeetings = archivedMeetings.filter((m) => m.id !== id);
          archiveDetailCache.delete(id);
          meetingArchiveModal.hidden = false;
          renderArchiveList();
        }
      }
    } catch {
      // no-op; row remains, user can retry
    }
  });
}

/* ================================================================
   NEWS
   ================================================================ */
const newsListEl = document.getElementById('newsList');
const newsEmptyEl = document.getElementById('newsEmpty');
const newsNavBadge = document.getElementById('newsNavBadge');
const newsRefreshBtn = document.getElementById('newsRefreshBtn');

let newsItems = [];

function formatNewsDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function newsRowHtml(item) {
  const isRead = Boolean(item.read_at);
  return `
    <li class="news-row${isRead ? ' is-read' : ''}" data-id="${item.id}">
      <span class="news-row-dot" aria-hidden="true"></span>
      ${
        item.image_url
          ? `<a class="news-row-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-id="${item.id}"><img src="${escapeHtml(item.image_url)}" alt="" loading="lazy"></a>`
          : ''
      }
      <div class="news-row-main">
        <a class="news-row-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-id="${item.id}">${escapeHtml(item.title)}</a>
        <div class="news-row-meta">
          ${item.source ? `<span class="news-row-source">${escapeHtml(item.source)}</span>` : ''}
          <span class="news-row-date">${formatNewsDate(item.published_at || item.created_at)}</span>
        </div>
      </div>
      <div class="news-row-actions">
        <button type="button" class="news-row-read-btn" data-id="${item.id}" data-read="${isRead ? '1' : '0'}">${isRead ? 'Mark Unread' : 'Mark Read'}</button>
        <button type="button" class="news-row-dismiss" data-id="${item.id}" aria-label="Dismiss">&times;</button>
      </div>
    </li>`;
}

function updateNewsBadge() {
  if (!newsNavBadge) return;
  const unread = newsItems.filter((i) => !i.read_at).length;
  newsNavBadge.hidden = unread === 0;
  newsNavBadge.textContent = unread > 99 ? '99+' : String(unread);
}

function renderNewsList() {
  if (!newsListEl) return;
  renderHomeDashboard();
  if (!newsItems.length) {
    if (newsEmptyEl) newsEmptyEl.hidden = false;
    newsListEl.innerHTML = '';
    return;
  }
  if (newsEmptyEl) newsEmptyEl.hidden = true;
  newsListEl.innerHTML = newsItems.map(newsRowHtml).join('');
}

async function loadNews() {
  try {
    const res = await fetch('/api/news');
    if (res.ok) {
      const data = await res.json();
      newsItems = data.items || [];
    }
  } catch {
    // leave prior items on screen; Refresh lets the user retry
  }
  renderNewsList();
  updateNewsBadge();
}

async function setNewsItemRead(id, read) {
  const item = newsItems.find((i) => i.id === id);
  if (!item) return;
  item.read_at = read ? new Date().toISOString() : null;
  renderNewsList();
  updateNewsBadge();
  try {
    await fetch(`/api/news/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read }),
    });
  } catch {
    // optimistic update stands; Refresh will resync if the request failed
  }
}

if (newsListEl) {
  newsListEl.addEventListener('click', (e) => {
    const link = e.target.closest('.news-row-title, .news-row-thumb');
    if (link) {
      setNewsItemRead(Number(link.dataset.id), true);
      return;
    }
    const readBtn = e.target.closest('.news-row-read-btn');
    if (readBtn) {
      setNewsItemRead(Number(readBtn.dataset.id), readBtn.dataset.read !== '1');
      return;
    }
    const dismissBtn = e.target.closest('.news-row-dismiss');
    if (dismissBtn) {
      const id = Number(dismissBtn.dataset.id);
      newsItems = newsItems.filter((i) => i.id !== id);
      renderNewsList();
      updateNewsBadge();
      fetch(`/api/news/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  });
}

if (newsRefreshBtn) newsRefreshBtn.addEventListener('click', loadNews);

/* ================================================================
   HOME — at-a-glance summary of Calendar, Action Items, and News
   ================================================================ */
const homeCalendarList = document.getElementById('homeCalendarList');
const homeActionItemsList = document.getElementById('homeActionItemsList');
const homeNewsList = document.getElementById('homeNewsList');

function homeCalendarRowHtml(ev) {
  const dateLabel =
    ev.start_date === ev.end_date
      ? formatShortDate(ev.start_date)
      : `${formatShortDate(ev.start_date)} – ${formatShortDate(ev.end_date)}`;
  return `
    <div class="home-row">
      <span class="home-row-swatch" style="background:${calEventColor(ev)}"></span>
      <span class="home-row-title">${escapeHtml(ev.name)}</span>
      <span class="home-row-meta">${dateLabel}</span>
    </div>`;
}

function homeActionItemRowHtml(t) {
  return `
    <div class="home-row">
      <span class="action-items-priority-dot action-items-priority-dot--${t.priority}"></span>
      <span class="home-row-title">${escapeHtml(t.name)}</span>
      <span class="home-row-meta">${t.due_date ? formatShortDate(t.due_date) : ''}</span>
    </div>`;
}

function homeNewsRowHtml(item) {
  return `
    <a class="home-row home-row--link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-id="${item.id}">
      <span class="home-row-title">${escapeHtml(item.title)}</span>
      <span class="home-row-meta">${item.source ? `${escapeHtml(item.source)} · ` : ''}${formatNewsDate(item.published_at || item.created_at)}</span>
    </a>`;
}

function renderHomeDashboard() {
  if (homeCalendarList) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = calEvents
      .filter((ev) => parseDate(ev.end_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);
    homeCalendarList.innerHTML = upcoming.length
      ? upcoming.map(homeCalendarRowHtml).join('')
      : '<p class="home-card-empty">No upcoming events.</p>';
  }

  if (homeActionItemsList) {
    const outstanding = actionItems
      .filter((t) => !t.completed)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.name.localeCompare(b.name))
      .slice(0, 5);
    homeActionItemsList.innerHTML = outstanding.length
      ? outstanding.map(homeActionItemRowHtml).join('')
      : '<p class="home-card-empty">No outstanding tasks.</p>';
  }

  if (homeNewsList) {
    const unread = newsItems.filter((i) => !i.read_at).slice(0, 5);
    homeNewsList.innerHTML = unread.length
      ? unread.map(homeNewsRowHtml).join('')
      : '<p class="home-card-empty">No unread news.</p>';
  }
}

document.querySelectorAll('.home-card-link[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

if (homeNewsList) {
  homeNewsList.addEventListener('click', (e) => {
    const link = e.target.closest('.home-row--link');
    if (link) setNewsItemRead(Number(link.dataset.id), true);
  });
}

/* ---- Initial page ------------------------------------------- */
const initialPage = validPages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
showPage(initialPage);
loadNews();
if (!actionItemsLoaded) loadActionItems();
if (!calendarLoaded) loadCalendar();

});
