/* Great Rooms Tracker -- single-file SPA. No build step, no framework. */

const API = '/api';

const state = {
  token: localStorage.getItem('gr_token') || null,
  role: localStorage.getItem('gr_role') || null,
  storeKey: localStorage.getItem('gr_storeKey') || null,
  storeName: localStorage.getItem('gr_storeName') || null,
  adminTab: 'dashboard',
};

function persistAuth() {
  if (state.token) {
    localStorage.setItem('gr_token', state.token);
    localStorage.setItem('gr_role', state.role || '');
    localStorage.setItem('gr_storeKey', state.storeKey || '');
    localStorage.setItem('gr_storeName', state.storeName || '');
  } else {
    localStorage.removeItem('gr_token');
    localStorage.removeItem('gr_role');
    localStorage.removeItem('gr_storeKey');
    localStorage.removeItem('gr_storeName');
  }
}

function logout() {
  state.token = null;
  state.role = null;
  state.storeKey = null;
  state.storeName = null;
  persistAuth();
  render();
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (res.status === 401) { logout(); throw new Error('Session expired, please log in again.'); }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtMoney(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString();
}
function fmtPct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(digits)}%`;
}
function diffPill(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '<span class="hint">—</span>';
  const cls = n >= 0 ? 'pos' : 'neg';
  const sign = n > 0 ? '+' : '';
  return `<span class="pill ${cls}">${sign}${Number(n).toFixed(digits)}</span>`;
}
function todayYMD() {
  const d = new Date();
  return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, day: d.getDate() };
}
function monthLabel(month) {
  const [y, m] = month.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* The 7 revenue categories from the Good Money sheet, and the "begin" record
   key each category's monthly budget is stored under (entered by the store
   manager at the start of the month, alongside Customers/PARR/BOR/APU). */
const REVCATS = [
  { key: 'rentalRevenue', budgetKey: 'budgetRentalRevenue', label: 'Rental Revenue' },
  { key: 'damageWaivers', budgetKey: 'budgetDamageWaivers', label: 'Damage Waivers' },
  { key: 'renewalFees', budgetKey: 'budgetRenewalFees', label: 'Renewal Fees' },
  { key: 'agreementFees', budgetKey: 'budgetAgreementFees', label: 'Agreement Fees' },
  { key: 'clubFees', budgetKey: 'budgetClubFees', label: 'Club Fees' },
  { key: 'ihcFees', budgetKey: 'budgetIhcFees', label: 'IHC Fees (Trip Fee)' },
  { key: 'cashSales', budgetKey: 'budgetCashSales', label: 'Cash Sales' },
];

function topbar(rightHtml) {
  return `
  <div class="topbar">
    <div class="brand"><span class="roof"></span><div>GREAT ROOMS<small>SALES &amp; LEASE PURCHASE</small></div></div>
    <div class="who">${rightHtml}</div>
  </div>`;
}

/* ---------------- Root render/router ---------------- */

function render() {
  const app = document.getElementById('app');
  if (!state.token) {
    app.innerHTML = '';
    app.appendChild(LoginScreen());
  } else if (state.role === 'admin') {
    app.innerHTML = '';
    app.appendChild(AdminScreen());
  } else {
    app.innerHTML = '';
    app.appendChild(StoreScreen());
  }
}

/* ---------------- Login ---------------- */

function LoginScreen() {
  const wrap = el(`<div>
    ${topbar('')}
    <div class="login-wrap">
      <div class="card">
        <h2>Sign in</h2>
        <div class="sub">Pick your store to enter today's numbers.</div>
        <div id="storeList"><div class="hint">Loading stores…</div></div>
      </div>
      <div class="card">
        <h2>Admin</h2>
        <div class="sub">Josh's login for the dashboard, month-end and awards.</div>
        <div id="adminMsg"></div>
        <div class="field"><label>Admin password</label><input type="password" id="adminPw" /></div>
        <button id="adminLoginBtn">Sign in as admin</button>
      </div>
    </div>
  </div>`);

  api('/public-stores', { auth: false }).then(({ stores }) => {
    const list = wrap.querySelector('#storeList');
    list.innerHTML = '';
    stores.forEach((s) => {
      const btn = el(`<button class="store-btn" type="button">${s.name}</button>`);
      btn.addEventListener('click', () => showPinPrompt(list, s));
      list.appendChild(btn);
    });
    if (stores.length === 0) list.innerHTML = '<div class="hint">No stores configured yet.</div>';
  }).catch((e) => {
    wrap.querySelector('#storeList').innerHTML = `<div class="msg error">${e.message}</div>`;
  });

  function showPinPrompt(list, store) {
    list.innerHTML = `
      <div class="field"><label>${store.name} PIN</label><input type="password" inputmode="numeric" id="pinInput" maxlength="8" autofocus /></div>
      <div id="pinMsg"></div>
      <button id="pinGo">Enter</button>
      <button class="secondary" id="pinBack" type="button">Back</button>`;
    list.querySelector('#pinGo').addEventListener('click', async () => {
      const pin = list.querySelector('#pinInput').value.trim();
      try {
        const data = await api('/login', { method: 'POST', auth: false, body: { storeKey: store.key, pin } });
        state.token = data.token; state.role = 'store'; state.storeKey = data.storeKey; state.storeName = data.storeName;
        persistAuth(); render();
      } catch (e) {
        list.querySelector('#pinMsg').innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
    list.querySelector('#pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') list.querySelector('#pinGo').click(); });
    list.querySelector('#pinBack').addEventListener('click', () => render());
  }

  wrap.querySelector('#adminLoginBtn').addEventListener('click', async () => {
    const pw = wrap.querySelector('#adminPw').value;
    try {
      const data = await api('/login', { method: 'POST', auth: false, body: { adminPassword: pw } });
      state.token = data.token; state.role = 'admin'; state.storeKey = null; state.storeName = null;
      persistAuth(); render();
    } catch (e) {
      wrap.querySelector('#adminMsg').innerHTML = `<div class="msg error">${e.message}</div>`;
    }
  });

  return wrap;
}

/* ---------------- Store daily-entry screen ---------------- */

function StoreScreen() {
  const { month: curMonth, day: curDay } = todayYMD();
  const view = { month: curMonth };

  const wrap = el(`<div>
    ${topbar(`${state.storeName} <button class="secondary" id="logoutBtn">Log out</button>`)}
    <div class="wrap">
      <div class="card">
        <h2>Today's numbers</h2>
        <div class="sub">Enter this month's running totals (same as your revenue tracker) -- not just today's activity.</div>
        <div id="msg"></div>
        <div class="grid cols-4">
          <div class="field"><label>Month</label><input type="month" id="f_month" value="${curMonth}" /></div>
          <div class="field"><label>Day of month</label><input type="number" min="1" max="31" id="f_day" value="${curDay}" /></div>
        </div>
        <div class="section-title">Revenue (month-to-date totals)</div>
        <div class="grid cols-4">
          ${REVCATS.map((c) => moneyField(c.key, c.label)).join('')}
        </div>
        <div class="section-title">% of Budget (live, vs. this month's beginning-of-month budget)</div>
        <div id="pctBudgetWrap" class="grid cols-4"></div>
        <div class="section-title">Customers &amp; portfolio (current, as of today)</div>
        <div class="grid cols-4">
          ${plainField('customers', 'Current Customers')}
          ${moneyField('parr', 'Current PARR')}
          ${plainField('bor', 'Current BOR')}
          ${moneyField('apu', 'Current APU')}
        </div>
        <button id="saveBtn">Save today's numbers</button>
      </div>

      <div class="card">
        <h2>Beginning of month</h2>
        <div class="sub">Set once at the start of the month, from the Good Money sheet -- used to calculate growth and to drive % of Budget above.</div>
        <div class="grid cols-4">
          ${plainField('b_customers', 'Beginning Customers')}
          ${moneyField('b_parr', 'Beginning PARR')}
          ${plainField('b_bor', 'Beginning BOR')}
          ${moneyField('b_apu', 'Beginning APU')}
        </div>
        <div class="section-title">Budgets for this month (from the Good Money sheet)</div>
        <div class="grid cols-4">
          ${REVCATS.map((c) => moneyField('b_' + c.budgetKey, 'Budget: ' + c.label)).join('')}
          ${moneyField('b_budgetGoodMoney', 'Budgeted Good Money')}
        </div>
        <button class="secondary" id="saveBeginBtn">Save beginning-of-month</button>
      </div>

      <div class="card">
        <h2>This month so far</h2>
        <div id="historyWrap"><div class="hint">Loading…</div></div>
      </div>
    </div>
  </div>`);

  function moneyField(id, label) {
    return `<div class="field"><label>${label}</label><input type="number" step="0.01" id="f_${id}" /></div>`;
  }
  function plainField(id, label) {
    return `<div class="field"><label>${label}</label><input type="number" step="0.01" id="f_${id}" /></div>`;
  }

  wrap.querySelector('#logoutBtn').addEventListener('click', logout);

  let beginRecord = {};

  function renderPctOfBudget() {
    const pctWrap = wrap.querySelector('#pctBudgetWrap');
    if (!pctWrap) return;
    const rows = REVCATS.map((c) => {
      const val = Number(wrap.querySelector(`#f_${c.key}`).value || 0);
      const budget = Number(beginRecord[c.budgetKey] || 0);
      const pct = budget ? (val / budget) * 100 : null;
      return `<div class="field"><label>${c.label}</label><div style="font-weight:700;padding:8px 0;">${fmtPct(pct)}</div></div>`;
    });
    const total = REVCATS.reduce((s, c) => s + Number(wrap.querySelector(`#f_${c.key}`).value || 0), 0);
    const gmBudget = Number(beginRecord.budgetGoodMoney || 0);
    const gmPct = gmBudget ? (total / gmBudget) * 100 : null;
    rows.push(`<div class="field"><label>Good Money (total)</label><div style="font-weight:800;padding:8px 0;">${fmtPct(gmPct)}</div></div>`);
    pctWrap.innerHTML = rows.join('');
  }
  REVCATS.forEach((c) => wrap.querySelector(`#f_${c.key}`).addEventListener('input', renderPctOfBudget));

  async function loadHistory() {
    const month = wrap.querySelector('#f_month').value || curMonth;
    view.month = month;
    const data = await api(`/daily-entry?month=${month}`);
    const store = data[state.storeKey] || { begin: null, days: [] };
    beginRecord = store.begin || {};

    if (store.begin) {
      wrap.querySelector('#f_b_customers').value = store.begin.customers ?? '';
      wrap.querySelector('#f_b_parr').value = store.begin.parr ?? '';
      wrap.querySelector('#f_b_bor').value = store.begin.bor ?? '';
      wrap.querySelector('#f_b_apu').value = store.begin.apu ?? '';
      REVCATS.forEach((c) => { const f = wrap.querySelector(`#f_b_${c.budgetKey}`); if (f) f.value = store.begin[c.budgetKey] ?? ''; });
      wrap.querySelector('#f_b_budgetGoodMoney').value = store.begin.budgetGoodMoney ?? '';
    }

    const last = store.days[store.days.length - 1];
    if (last) {
      ['rentalRevenue','damageWaivers','renewalFees','agreementFees','clubFees','ihcFees','cashSales','customers','parr','bor','apu']
        .forEach((k) => { const f = wrap.querySelector(`#f_${k}`); if (f) f.value = last[k] ?? ''; });
    }
    renderPctOfBudget();

    const rows = store.days.map((d) => {
      const total = ['rentalRevenue','damageWaivers','renewalFees','agreementFees','clubFees','ihcFees','cashSales']
        .reduce((s, k) => s + (d[k] || 0), 0);
      return `<tr>
        <td>${d.day}</td>
        <td>${fmtMoney(total)}</td>
        <td>${fmtNum(d.customers)}</td>
        <td>${fmtMoney(d.parr)}</td>
        <td>${fmtNum(d.bor)}</td>
        <td>${fmtMoney(d.apu)}</td>
      </tr>`;
    }).join('');

    const hw = wrap.querySelector('#historyWrap');
    if (store.days.length === 0) {
      hw.innerHTML = '<div class="hint">No entries yet this month.</div>';
    } else {
      hw.innerHTML = `<table>
        <thead><tr><th>Day</th><th>Total Rev</th><th>Customers</th><th>PARR</th><th>BOR</th><th>APU</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
      if (store.begin && last) {
        hw.innerHTML += `<div class="section-title">Growth vs. beginning of month</div>
          <div class="grid cols-4">
            <div>Customers ${diffPill((last.customers ?? 0) - (store.begin.customers ?? 0))}</div>
            <div>PARR ${diffPill((last.parr ?? 0) - (store.begin.parr ?? 0))}</div>
            <div>BOR ${diffPill((last.bor ?? 0) - (store.begin.bor ?? 0))}</div>
            <div>APU ${diffPill((last.apu ?? 0) - (store.begin.apu ?? 0), 2)}</div>
          </div>`;
      }
    }
  }

  wrap.querySelector('#f_month').addEventListener('change', () => loadHistory().catch(showErr));
  function showErr(e) { wrap.querySelector('#msg').innerHTML = `<div class="msg error">${e.message}</div>`; }

  wrap.querySelector('#saveBtn').addEventListener('click', async () => {
    const month = wrap.querySelector('#f_month').value;
    const day = wrap.querySelector('#f_day').value;
    const body = { month, day };
    ['rentalRevenue','damageWaivers','renewalFees','agreementFees','clubFees','ihcFees','cashSales','customers','parr','bor','apu']
      .forEach((k) => { body[k] = wrap.querySelector(`#f_${k}`).value; });
    try {
      await api('/daily-entry', { method: 'POST', body });
      wrap.querySelector('#msg').innerHTML = '<div class="msg ok">Saved.</div>';
      await loadHistory();
    } catch (e) { showErr(e); }
  });

  wrap.querySelector('#saveBeginBtn').addEventListener('click', async () => {
    const month = wrap.querySelector('#f_month').value;
    const day = wrap.querySelector('#f_day').value || 1;
    const begin = {
      customers: wrap.querySelector('#f_b_customers').value,
      parr: wrap.querySelector('#f_b_parr').value,
      bor: wrap.querySelector('#f_b_bor').value,
      apu: wrap.querySelector('#f_b_apu').value,
      budgetGoodMoney: wrap.querySelector('#f_b_budgetGoodMoney').value,
    };
    REVCATS.forEach((c) => { begin[c.budgetKey] = wrap.querySelector(`#f_b_${c.budgetKey}`).value; });
    try {
      await api('/daily-entry', { method: 'POST', body: { month, day, begin } });
      wrap.querySelector('#msg').innerHTML = '<div class="msg ok">Beginning-of-month saved.</div>';
      beginRecord = begin;
      renderPctOfBudget();
    } catch (e) { showErr(e); }
  });

  loadHistory().catch(showErr);
  return wrap;
}

/* ---------------- Admin screen ---------------- */

function AdminScreen() {
  const wrap = el(`<div>
    ${topbar(`Admin <button class="secondary" id="logoutBtn">Log out</button>`)}
    <div class="wrap">
      <div class="tabs">
        <button data-tab="dashboard">Dashboard</button>
        <button data-tab="stores">Stores</button>
        <button data-tab="monthend">Month-End &amp; Awards</button>
      </div>
      <div id="tabBody"></div>
    </div>
  </div>`);

  wrap.querySelector('#logoutBtn').addEventListener('click', logout);

  const tabButtons = wrap.querySelectorAll('.tabs button');
  function setTab(tab) {
    state.adminTab = tab;
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const body = wrap.querySelector('#tabBody');
    body.innerHTML = '';
    if (tab === 'dashboard') body.appendChild(AdminDashboard());
    if (tab === 'stores') body.appendChild(AdminStores());
    if (tab === 'monthend') body.appendChild(AdminMonthEnd());
  }
  tabButtons.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  setTab(state.adminTab || 'dashboard');

  return wrap;
}

function AdminDashboard() {
  const { month: curMonth } = todayYMD();
  const box = el(`<div>
    <div class="card">
      <div class="field" style="max-width:220px;"><label>Month</label><input type="month" id="d_month" value="${curMonth}" /></div>
      <div id="dashBody"><div class="hint">Loading…</div></div>
    </div>
  </div>`);

  async function load() {
    const month = box.querySelector('#d_month').value;
    const [storesRes, entriesRes] = await Promise.all([
      api('/stores'),
      api(`/daily-entry?month=${month}`),
    ]);
    const stores = storesRes.stores;
    const body = box.querySelector('#dashBody');

    const metricRow = (label, get, fmt = fmtMoney) => `<tr><td>${label}</td>${stores.map((s) => {
      const d = entriesRes[s.key];
      const last = d && d.days[d.days.length - 1];
      return `<td>${fmt(get(last, d && d.begin))}</td>`;
    }).join('')}</tr>`;

    const totalOf = (last) => !last ? null : REVCATS.reduce((s, c) => s + (last[c.key] || 0), 0);
    const budgetTotalOf = (begin) => !begin ? null : REVCATS.reduce((s, c) => s + (Number(begin[c.budgetKey]) || 0), 0);

    body.innerHTML = `
      <table>
        <thead><tr><th>Metric</th>${stores.map((s) => `<th>${s.name}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td>Last entry (day)</td>${stores.map((s) => { const d = entriesRes[s.key]; const last = d && d.days[d.days.length - 1]; return `<td>${last ? last.day : '—'}</td>`; }).join('')}</tr>
          ${metricRow('Rental Revenue', (l) => l?.rentalRevenue)}
          ${metricRow('Damage Waivers', (l) => l?.damageWaivers)}
          ${metricRow('Renewal Fees', (l) => l?.renewalFees)}
          ${metricRow('Agreement Fees', (l) => l?.agreementFees)}
          ${metricRow('Club Fees', (l) => l?.clubFees)}
          ${metricRow('IHC Fees', (l) => l?.ihcFees)}
          ${metricRow('Cash Sales', (l) => l?.cashSales)}
          <tr style="font-weight:800;"><td>Total MTD Revenue</td>${stores.map((s) => { const d = entriesRes[s.key]; const last = d && d.days[d.days.length - 1]; return `<td>${fmtMoney(totalOf(last))}</td>`; }).join('')}</tr>
          <tr><td>Budgeted Good Money</td>${stores.map((s) => { const d = entriesRes[s.key]; return `<td>${fmtMoney(d?.begin?.budgetGoodMoney ?? budgetTotalOf(d?.begin))}</td>`; }).join('')}</tr>
          <tr style="font-weight:800;"><td>% of Budget (Good Money)</td>${stores.map((s) => { const d = entriesRes[s.key]; const last = d && d.days[d.days.length - 1]; const t = totalOf(last); const bt = d?.begin?.budgetGoodMoney || budgetTotalOf(d?.begin); const pct = t !== null && bt ? (t / bt) * 100 : null; return `<td>${fmtPct(pct)}</td>`; }).join('')}</tr>
          ${metricRow('Customers', (l) => l?.customers, fmtNum)}
          ${metricRow('PARR', (l) => l?.parr)}
          ${metricRow('BOR', (l) => l?.bor, fmtNum)}
          ${metricRow('APU', (l) => l?.apu)}
        </tbody>
      </table>
      <div class="section-title">% of Budget by category</div>
      <table>
        <thead><tr><th>Category</th>${stores.map((s) => `<th>${s.name}</th>`).join('')}</tr></thead>
        <tbody>
          ${REVCATS.map((c) => `<tr><td>${c.label}</td>${stores.map((s) => {
            const d = entriesRes[s.key];
            const last = d && d.days[d.days.length - 1];
            const val = last ? last[c.key] : null;
            const budget = d?.begin ? Number(d.begin[c.budgetKey]) : null;
            const pct = (val !== null && val !== undefined && budget) ? (val / budget) * 100 : null;
            return `<td>${fmtPct(pct)}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  box.querySelector('#d_month').addEventListener('change', () => load().catch((e) => {
    box.querySelector('#dashBody').innerHTML = `<div class="msg error">${e.message}</div>`;
  }));
  load().catch((e) => { box.querySelector('#dashBody').innerHTML = `<div class="msg error">${e.message}</div>`; });
  return box;
}

function AdminStores() {
  const box = el(`<div><div class="card"><h2>Stores</h2>
    <div class="sub">Manage store names and PINs. Monthly budgets aren't set here anymore -- each store manager enters their own budget numbers (from the Good Money sheet) in their "Beginning of month" section at the start of each month.</div>
    <div id="storesBody"><div class="hint">Loading…</div></div></div>
  <div class="card">
    <h2>Add a store</h2>
    <div class="grid cols-3">
      <div class="field"><label>Key (no spaces)</label><input id="ns_key" placeholder="e.g. tampa" /></div>
      <div class="field"><label>Name</label><input id="ns_name" placeholder="e.g. Tampa" /></div>
      <div class="field"><label>PIN</label><input id="ns_pin" placeholder="4-digit PIN" /></div>
    </div>
    <button id="addStoreBtn">Add store</button>
    <div id="addMsg"></div>
  </div></div>`);

  async function load() {
    const { stores } = await api('/stores');
    const body = box.querySelector('#storesBody');
    body.innerHTML = stores.map((s) => `
      <div style="border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:16px;">
        <div class="grid cols-3" style="align-items:end;">
          <div class="field"><label>Name</label><input data-key="${s.key}" data-field="name" value="${s.name}" /></div>
          <div class="field"><label>New PIN (blank = unchanged)</label><input data-key="${s.key}" data-field="pin" placeholder="••••" /></div>
          <button data-save="${s.key}">Save ${s.name}</button>
        </div>
      </div>`).join('');
    body.querySelectorAll('button[data-save]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.save;
        const name = body.querySelector(`input[data-key="${key}"][data-field="name"]`).value;
        const pin = body.querySelector(`input[data-key="${key}"][data-field="pin"]`).value;
        try {
          await api('/stores', { method: 'PUT', body: { key, name, pin: pin || undefined } });
          btn.textContent = 'Saved ✓';
          setTimeout(() => (btn.textContent = `Save ${name}`), 1500);
          await load();
        } catch (e) { alert(e.message); }
      });
    });
  }

  box.querySelector('#addStoreBtn').addEventListener('click', async () => {
    const key = box.querySelector('#ns_key').value.trim().toLowerCase().replace(/\s+/g, '');
    const name = box.querySelector('#ns_name').value.trim();
    const pin = box.querySelector('#ns_pin').value.trim();
    if (!key || !name || !pin) { box.querySelector('#addMsg').innerHTML = '<div class="msg error">Key, name and PIN are required.</div>'; return; }
    try {
      await api('/stores', { method: 'PUT', body: { key, name, pin } });
      box.querySelector('#addMsg').innerHTML = '<div class="msg ok">Store added.</div>';
      ['ns_key','ns_name','ns_pin'].forEach((id) => (box.querySelector(`#${id}`).value = ''));
      await load();
    } catch (e) { box.querySelector('#addMsg').innerHTML = `<div class="msg error">${e.message}</div>`; }
  });

  load().catch((e) => { box.querySelector('#storesBody').innerHTML = `<div class="msg error">${e.message}</div>`; });
  return box;
}

function AdminMonthEnd() {
  const { month: curMonth } = todayYMD();
  const ctx = { month: curMonth, storeNames: {}, suggestions: {} };

  const box = el(`<div>
    <div class="card">
      <div class="field" style="max-width:220px;"><label>Month</label><input type="month" id="me_month" value="${curMonth}" /></div>
    </div>

    <div class="card">
      <h2>1. Upload the Daily Report (month-end)</h2>
      <div class="sub">Upload the company-wide Daily Report PDF dated the last day of the month. It's parsed automatically for PARR growth, customer growth, % collected, etc.</div>
      <input type="file" id="dr_file" accept="application/pdf" />
      <div id="dr_msg"></div>
    </div>

    <div class="card">
      <h2>2. End-of-month checklist, per store</h2>
      <div class="sub">Type in what's on each store's handwritten EOM checklist. You can also attach a photo/PDF of it for your records.</div>
      <div id="eomBody"></div>
    </div>

    <div class="card">
      <h2>3. Store of the Month</h2>
      <div id="somBody"><div class="hint">Fill in steps 1 &amp; 2, then this computes automatically.</div></div>
    </div>
  </div>`);

  box.querySelector('#dr_file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = box.querySelector('#dr_msg');
    msg.innerHTML = '<div class="hint">Parsing…</div>';
    try {
      const base64 = await fileToBase64(file);
      const record = await api('/daily-report', { method: 'POST', body: { filename: file.name, base64 } });
      msg.innerHTML = `<div class="msg ok">Parsed report dated ${record.reportDate} (month ${record.month}).${record.warnings?.length ? ' Warnings: ' + record.warnings.join('; ') : ''}</div>`;
      box.querySelector('#me_month').value = record.month;
      ctx.month = record.month;
      await loadAll();
    } catch (err) { msg.innerHTML = `<div class="msg error">${err.message}</div>`; }
  });

  async function loadStoresAndEom() {
    const { stores } = await api('/stores');
    ctx.storeNames = Object.fromEntries(stores.map((s) => [s.key, s.name]));
    const eomData = await api(`/eom-entry?month=${ctx.month}`);
    const eomBody = box.querySelector('#eomBody');
    eomBody.innerHTML = '';
    stores.forEach((s) => eomBody.appendChild(EomStoreForm(s, eomData[s.key], () => somRecompute())));
  }

  function EomStoreForm(store, existing, onSaved) {
    const rows = (existing?.associates && existing.associates.length ? existing.associates : [{ name: '', rents: '' }]);
    const card = el(`<div style="border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-weight:800;margin-bottom:8px;">${store.name}</div>
      <div class="grid cols-3">
        <div class="field"><label>Saturday Close %</label><input type="number" step="0.01" id="sc_${store.key}" value="${existing?.saturdayClosePct ?? ''}" /></div>
        <div class="field"><label>Monday Close %</label><input type="number" step="0.01" id="mc_${store.key}" value="${existing?.mondayClosePct ?? ''}" /></div>
        <div class="field"><label>Saturday Over 15% Avg</label><input type="number" step="0.01" id="so_${store.key}" value="${existing?.saturdayOverPct ?? ''}" /></div>
      </div>
      <div class="section-title" style="margin-top:10px;">Associates &amp; rents</div>
      <div id="assoc_${store.key}"></div>
      <button class="secondary" type="button" id="addAssoc_${store.key}">+ Add associate</button>
      <div class="file-row" style="margin-top:10px;">
        <input type="file" id="file_${store.key}" accept="image/*,application/pdf" />
        <span class="hint">${existing?.fileId ? 'A checklist file is already attached.' : 'Optional: attach the checklist photo/PDF'}</span>
      </div>
      <div style="margin-top:10px;"><button id="save_${store.key}">Save ${store.name}</button> <span id="msg_${store.key}"></span></div>
    </div>`);

    const assocWrap = card.querySelector(`#assoc_${store.key}`);
    function addRow(name = '', rents = '') {
      const row = el(`<div class="grid cols-2" style="margin-bottom:6px;">
        <input placeholder="Name" value="${name}" class="assoc-name" />
        <input placeholder="Rents" type="number" value="${rents}" class="assoc-rents" />
      </div>`);
      assocWrap.appendChild(row);
    }
    rows.forEach((r) => addRow(r.name, r.rents));
    card.querySelector(`#addAssoc_${store.key}`).addEventListener('click', () => addRow());

    card.querySelector(`#save_${store.key}`).addEventListener('click', async () => {
      const associates = Array.from(assocWrap.children).map((row) => ({
        name: row.querySelector('.assoc-name').value,
        rents: row.querySelector('.assoc-rents').value,
      })).filter((a) => a.name);

      let fileId;
      const fileInput = card.querySelector(`#file_${store.key}`);
      if (fileInput.files[0]) {
        const base64 = await fileToBase64(fileInput.files[0]);
        const up = await api('/upload', { method: 'POST', body: { filename: fileInput.files[0].name, contentType: fileInput.files[0].type, base64 } });
        fileId = up.fileId;
      }

      try {
        await api('/eom-entry', { method: 'POST', body: {
          storeKey: store.key,
          month: ctx.month,
          associates,
          saturdayClosePct: card.querySelector(`#sc_${store.key}`).value,
          mondayClosePct: card.querySelector(`#mc_${store.key}`).value,
          saturdayOverPct: card.querySelector(`#so_${store.key}`).value,
          fileId,
        }});
        card.querySelector(`#msg_${store.key}`).innerHTML = '<span class="pill pos">Saved</span>';
        onSaved();
      } catch (e) {
        card.querySelector(`#msg_${store.key}`).innerHTML = `<span class="pill neg">${e.message}</span>`;
      }
    });

    return card;
  }

  async function somRecompute(overrides) {
    const somBody = box.querySelector('#somBody');
    const qs = overrides ? `&overrides=${encodeURIComponent(JSON.stringify(overrides))}` : '';
    const data = await api(`/som-compute?month=${ctx.month}${qs}`);
    ctx.suggestions = data.suggestions;
    somBody.innerHTML = '';
    somBody.appendChild(SomResults(data));
  }

  function SomResults(data) {
    const names = data.storeNames;
    const fmtWinnerCard = (cls, label, name, sub) => `
      <div class="winner-card ${cls}"><div class="label">${label}</div><div class="name">${name}</div><div class="sub">${sub}</div></div>`;

    const container = el(`<div></div>`);
    container.innerHTML = `
      ${!data.reportFound ? '<div class="msg error">No Daily Report uploaded for this month yet -- PARR/customer/collection figures will be blank until you upload one.</div>' : ''}
      ${fmtWinnerCard('som', '🏆 Store of the Month', names[data.som.winner] || data.som.winner, `${data.som.totals[data.som.winner].toFixed(0)} points`)}
      ${data.salesperson ? fmtWinnerCard('person', '🏆 Salesperson of the Month', data.salesperson.name, `${data.salesperson.rents} rents · ${names[data.salesperson.storeKey] || data.salesperson.storeKey}`) : '<div class="hint">Add associate rents above to determine Salesperson of the Month.</div>'}
      ${fmtWinnerCard('collections', '🏆 Collections of the Month', names[data.collections.winner] || data.collections.winner, `${data.collections.totals[data.collections.winner].toFixed(0)} points`)}

      <div class="section-title">Fee rates -- % of Budget (auto-calculated from each store's own beginning-of-month budget entry; editable if something needs correcting)</div>
      <table>
        <thead><tr><th>Store</th><th>Trip Fee (IHC)</th><th>Club Fee</th><th>Agreement Fee</th><th>Renewal Fee</th></tr></thead>
        <tbody>
          ${Object.keys(names).map((k) => `<tr>
            <td>${names[k]}</td>
            <td><input type="number" step="0.01" class="rate-input" data-store="${k}" data-field="tripFeeRate" value="${data.dataByStore[k].tripFeeRate ?? ''}" />%</td>
            <td><input type="number" step="0.01" class="rate-input" data-store="${k}" data-field="clubFeeRate" value="${data.dataByStore[k].clubFeeRate ?? ''}" />%</td>
            <td><input type="number" step="0.01" class="rate-input" data-store="${k}" data-field="agreementFeeRate" value="${data.dataByStore[k].agreementFeeRate ?? ''}" />%</td>
            <td><input type="number" step="0.01" class="rate-input" data-store="${k}" data-field="renewalFeeRate" value="${data.dataByStore[k].renewalFeeRate ?? ''}" />%</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <button class="secondary" id="recomputeBtn" style="margin-top:8px;">Recompute with these rates</button>

      <div class="section-title">Store of the Month -- points by metric</div>
      <table><thead><tr><th>Metric</th>${Object.keys(names).map((k) => `<th>${names[k]}</th>`).join('')}</tr></thead>
        <tbody>
          ${data.som.metrics.map((m) => `<tr><td>${m.label}</td>${Object.keys(names).map((k) => `<td>${(data.som.breakdown[m.key][k] ?? 0).toFixed(0)}</td>`).join('')}</tr>`).join('')}
          <tr style="font-weight:800;"><td>Total</td>${Object.keys(names).map((k) => `<td>${data.som.totals[k].toFixed(0)}</td>`).join('')}</tr>
        </tbody>
      </table>

      <div style="margin-top:16px;">
        <button id="finalizeBtn">Finalize ${monthLabel(data.month)}</button>
        <button class="gold" id="sendAwardBtn" ${data.finalized ? '' : 'disabled'}>Email me the award</button>
        <span class="hint">${data.finalized ? 'This month is finalized.' : 'Finalize first, then send the award email.'}</span>
      </div>
      <div id="finalizeMsg"></div>
    `;

    container.querySelector('#recomputeBtn').addEventListener('click', () => {
      const overrides = {};
      container.querySelectorAll('.rate-input').forEach((inp) => {
        overrides[inp.dataset.store] = overrides[inp.dataset.store] || {};
        overrides[inp.dataset.store][inp.dataset.field] = inp.value === '' ? null : Number(inp.value);
      });
      somRecompute(overrides).catch((e) => alert(e.message));
    });

    container.querySelector('#finalizeBtn').addEventListener('click', async () => {
      const overrides = {};
      container.querySelectorAll('.rate-input').forEach((inp) => {
        overrides[inp.dataset.store] = overrides[inp.dataset.store] || {};
        overrides[inp.dataset.store][inp.dataset.field] = inp.value === '' ? null : Number(inp.value);
      });
      try {
        await api('/som-compute', { method: 'POST', body: { month: data.month, overrides } });
        container.querySelector('#finalizeMsg').innerHTML = '<div class="msg ok">Finalized. You can now email the award.</div>';
        container.querySelector('#sendAwardBtn').removeAttribute('disabled');
      } catch (e) { container.querySelector('#finalizeMsg').innerHTML = `<div class="msg error">${e.message}</div>`; }
    });

    container.querySelector('#sendAwardBtn').addEventListener('click', async () => {
      try {
        await api('/send-award', { method: 'POST', body: { month: data.month } });
        container.querySelector('#finalizeMsg').innerHTML = '<div class="msg ok">Award email sent!</div>';
      } catch (e) { container.querySelector('#finalizeMsg').innerHTML = `<div class="msg error">${e.message}</div>`; }
    });

    return container;
  }

  async function loadAll() {
    await loadStoresAndEom();
    await somRecompute().catch((e) => {
      box.querySelector('#somBody').innerHTML = `<div class="msg error">${e.message}</div>`;
    });
  }

  box.querySelector('#me_month').addEventListener('change', () => {
    ctx.month = box.querySelector('#me_month').value;
    loadAll();
  });

  loadAll();
  return box;
}

render();
