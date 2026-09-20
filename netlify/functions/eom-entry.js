const { getJSON, setJSON } = require('../../lib/blobs');
const { requireStore, getConfig } = require('../../lib/auth');

const EOM_STORE = 'eom';

function key(month, storeKey) {
  return `${month}/${storeKey}`;
}

exports.handler = async (event) => {
  try {
  const auth = requireStore(event);
  if (!auth) return json(401, { error: 'Unauthorized' });

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const month = params.month;
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });
    const storeKeys = params.storeKey
      ? [params.storeKey]
      : auth.role === 'admin'
        ? (await getConfig()).storeOrder
        : [auth.storeKey];

    const result = {};
    for (const sk of storeKeys) {
      if (auth.role !== 'admin' && sk !== auth.storeKey) continue;
      result[sk] = await getJSON(EOM_STORE, key(month, sk));
    }
    return json(200, result);
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const storeKey = auth.role === 'admin' && body.storeKey ? body.storeKey : auth.storeKey;
    const { month } = body;
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });

    const record = {
      storeKey,
      month,
      associates: Array.isArray(body.associates)
        ? body.associates
            .filter((a) => a && a.name)
            .map((a) => ({ name: String(a.name).trim(), rents: Number(a.rents) || 0 }))
        : [],
      saturdayClosePct: numOrNull(body.saturdayClosePct),
      mondayClosePct: numOrNull(body.mondayClosePct),
      saturdayOverPct: numOrNull(body.saturdayOverPct),
      idleInventoryCompleted: !!body.idleInventoryCompleted,
      removedFromInventory: !!body.removedFromInventory,
      fileId: body.fileId || null,
      savedAt: new Date().toISOString(),
    };
    await setJSON(EOM_STORE, key(month, storeKey), record);
    return json(200, { ok: true, record });
  }

  return { statusCode: 405, body: 'Method not allowed' };
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function numOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
