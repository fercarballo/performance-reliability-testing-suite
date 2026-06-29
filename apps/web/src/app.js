// Minimal vanilla client for the demo journeys. No framework on purpose: the
// point of this project is the API + reliability tooling, not the UI.
const API = `http://${location.hostname}:3000`;

const state = { token: null, customerId: null };

const $ = (id) => document.getElementById(id);
const setStatus = (el, msg, ok) => {
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'err'}`;
};

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// --- Health pill -----------------------------------------------------------
async function refreshHealth() {
  const pill = $('apiPill');
  try {
    const h = await fetch(`${API}/health`).then((r) => r.json());
    pill.textContent = `API ${h.status} · db ${h.database} · redis ${h.redis}`;
    pill.className = `pill ${h.status === 'ok' ? 'pill-ok' : 'pill-down'}`;
  } catch {
    pill.textContent = 'API unreachable';
    pill.className = 'pill pill-down';
  }
}

// --- Login -----------------------------------------------------------------
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { username: $('username').value, password: $('password').value },
    });
    state.token = data.accessToken;
    state.customerId = data.customerId;
    setStatus($('loginStatus'), `Signed in as ${data.customerId}`, true);
    $('app').hidden = false;
    await loadPlans();
  } catch (err) {
    setStatus($('loginStatus'), err.message, false);
  }
});

// --- Invoices --------------------------------------------------------------
$('loadInvoices').addEventListener('click', async () => {
  const box = $('invoices');
  box.innerHTML = '';
  try {
    const data = await api(`/customers/${state.customerId}/invoices`);
    for (const inv of data.invoices) {
      const row = document.createElement('div');
      row.className = 'invoice';
      row.innerHTML = `
        <span>${inv.invoiceId} · $${inv.amount.toLocaleString()}</span>
        <span class="badge ${inv.status}">${inv.status}</span>`;
      box.appendChild(row);
    }
    if (!data.invoices.length) box.textContent = 'No invoices.';
  } catch (err) {
    box.textContent = err.message;
  }
});

// --- Plans -----------------------------------------------------------------
async function loadPlans() {
  try {
    const { plans } = await api('/plans');
    const sel = $('planSelect');
    sel.innerHTML = '';
    for (const p of plans) {
      const opt = document.createElement('option');
      opt.value = p.planId;
      opt.textContent = `${p.name} — $${p.monthlyPrice.toLocaleString()}`;
      sel.appendChild(opt);
    }
  } catch {
    /* ignore */
  }
}

$('changePlan').addEventListener('click', async () => {
  try {
    const data = await api(`/customers/${state.customerId}/plan-changes`, {
      method: 'POST',
      body: { targetPlanId: $('planSelect').value },
    });
    setStatus(
      $('planStatus'),
      `Change ${data.changeId} ${data.status} for ${data.effectiveDate}`,
      true,
    );
  } catch (err) {
    setStatus($('planStatus'), err.message, false);
  }
});

// --- Payment ---------------------------------------------------------------
$('payInvoice').addEventListener('click', async () => {
  const invoiceId = $('payInvoiceId').value.trim();
  if (!invoiceId) return setStatus($('payStatus'), 'Enter an invoice id', false);
  try {
    const data = await api('/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': `web-${state.customerId}-${invoiceId}` },
      body: {
        customerId: state.customerId,
        invoiceId,
        amount: 1,
        method: 'credit_card',
      },
    });
    setStatus(
      $('payStatus'),
      `Payment ${data.paymentId} → ${data.status} (invoice ${data.invoiceStatus})`,
      true,
    );
  } catch (err) {
    setStatus($('payStatus'), err.message, false);
  }
});

refreshHealth();
setInterval(refreshHealth, 5000);
