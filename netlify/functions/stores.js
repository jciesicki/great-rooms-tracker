const { getConfig, saveConfig, requireStore, requireAdmin, bcrypt } = require('../../lib/auth');
const { REVENUE_CATEGORIES, emptyBudgets } = require('../../lib/categories');

exports.handler = async (event) => {
  try {
    const config = await getConfig();

    if (event.httpMethod === 'GET') {
      const auth = requireStore(event);
      if (!auth) return json(401, { error: 'Unauthorized' });
      const stores = config.storeOrder
        .filter((k) => config.stores[k] && config.stores[k].active)
        .map((k) => {
          const budgets = config.stores[k].budgets || emptyBudgets();
          const totalBudget = Object.values(budgets).reduce((a, b) => a + (b || 0), 0);
          return { key: k, name: config.stores[k].name, budgets, totalBudget };
        });
      return json(200, { stores, categories: REVENUE_CATEGORIES });
    }

    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      const auth = requireAdmin(event);
      if (!auth) return json(401, { error: 'Admin only' });
      const body = JSON.parse(event.body || '{}');
      // body: { key, name, pin (optional), budgets: {rentalRevenue, damageWaivers, ...}, active }
      const { key, name, pin, budgets, active } = body;
      if (!key) return json(400, { error: 'key is required' });

      if (!config.stores[key]) {
        config.storeOrder.push(key);
        config.stores[key] = {
          name: name || key,
          pinHash: bcrypt.hashSync(pin || '0000', 10),
          budgets: normalizeBudgets(budgets),
          active: true,
        };
      } else {
        const s = config.stores[key];
        if (name !== undefined) s.name = name;
        if (pin) s.pinHash = bcrypt.hashSync(String(pin), 10);
        if (budgets !== undefined) s.budgets = { ...emptyBudgets(), ...s.budgets, ...normalizeBudgets(budgets) };
        if (active !== undefined) s.active = !!active;
      }
      await saveConfig(config);
      return json(200, { ok: true });
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function normalizeBudgets(budgets) {
  const out = emptyBudgets();
  if (!budgets) return out;
  for (const c of REVENUE_CATEGORIES) {
    if (budgets[c.key] !== undefined) out[c.key] = Number(budgets[c.key]) || 0;
  }
  return out;
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
