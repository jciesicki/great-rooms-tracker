const { getConfig } = require('../../lib/auth');

// Unauthenticated: just store keys + display names, for the login screen's
// "pick your store" buttons. No PINs, budgets or figures are exposed here.
exports.handler = async () => {
  try {
    const config = await getConfig();
    const stores = config.storeOrder
      .filter((k) => config.stores[k]?.active)
      .map((k) => ({ key: k, name: config.stores[k].name }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stores }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
