const { getConfig, signStoreToken, signAdminToken, bcrypt } = require('../../lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { storeKey, pin, adminPassword } = JSON.parse(event.body || '{}');
    const config = await getConfig();

    if (adminPassword !== undefined) {
      if (bcrypt.compareSync(adminPassword, config.adminPasswordHash)) {
        return json(200, { token: signAdminToken(), role: 'admin' });
      }
      return json(401, { error: 'Incorrect admin password' });
    }

    const store = config.stores[storeKey];
    if (!store || !store.active) return json(404, { error: 'Unknown store' });
    if (!bcrypt.compareSync(String(pin || ''), store.pinHash)) {
      return json(401, { error: 'Incorrect PIN' });
    }
    return json(200, { token: signStoreToken(storeKey), role: 'store', storeKey, storeName: store.name });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
