const { getJSON, setJSON, listKeys } = require('../../lib/blobs');
const { requireStore, getConfig } = require('../../lib/auth');

const DAILY_STORE = 'daily';

function dayKey(storeKey, month, day) {
  return `${storeKey}/${month}/${String(day).padStart(2, '0')}`;
}
function beginKey(storeKey, month) {
  return `${storeKey}/${month}/begin`;
}

exports.handler = async (event) => {
  try {
  const auth = requireStore(event);
  if (!auth) return json(401, { error: 'Unauthorized' });

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const month = params.month; // "YYYY-MM"
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });

    // Admins can request any store; store logins are locked to their own.
    const requestedStores = params.storeKey
      ? [params.storeKey]
      : auth.role === 'admin'
        ? (await getConfig()).storeOrder
        : [auth.storeKey];

    const result = {};
    for (const storeKey of requestedStores) {
      if (auth.role !== 'admin' && storeKey !== auth.storeKey) continue;
      const keys = await listKeys(DAILY_STORE, `${storeKey}/${month}/`);
      const days = [];
      let begin = null;
      for (const k of keys) {
        const entry = await getJSON(DAILY_STORE, k);
        if (!entry) continue;
        if (k.endsWith('/begin')) begin = entry;
        else days.push(entry);
      }
      days.sort((a, b) => a.day - b.day);
      result[storeKey] = { begin, days };
    }
    return json(200, result);
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const storeKey = auth.role === 'admin' && body.storeKey ? body.storeKey : auth.storeKey;
    const { month, day, begin, ...fields } = body;
    if (!month || !day) return json(400, { error: 'month and day are required' });

    if (begin) {
      await setJSON(DAILY_STORE, beginKey(storeKey, month), { ...begin, savedAt: new Date().toISOString() });
    }

    const entry = {
      storeKey,
      month,
      day: Number(day),
      rentalRevenue: num(fields.rentalRevenue),
      damageWaivers: num(fields.damageWaivers),
      renewalFees: num(fields.renewalFees),
      agreementFees: num(fields.agreementFees),
      clubFees: num(fields.clubFees),
      ihcFees: num(fields.ihcFees),
      cashSales: num(fields.cashSales),
      customers: num(fields.customers),
      parr: num(fields.parr),
      bor: num(fields.bor),
      apu: num(fields.apu),
      savedAt: new Date().toISOString(),
    };
    await setJSON(DAILY_STORE, dayKey(storeKey, month, day), entry);
    return json(200, { ok: true, entry });
  }

  return { statusCode: 405, body: 'Method not allowed' };
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function num(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
