const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJSON, setJSON } = require('./blobs');
const { emptyBudgets } = require('./categories');

const CONFIG_STORE = 'meta';
const CONFIG_KEY = 'config';

// Default store list -- edit PINs/names here on first boot, or change later
// through the admin panel (Admin > Stores), which rewrites this same record.
const DEFAULT_STORES = {
  lakeland: { name: 'Lakeland', pin: '4943' },
  winterhaven: { name: 'Winter Haven', pin: '1130' },
  clearwater: { name: 'Clearwater', pin: '1289' },
};

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is not set. Add it in Netlify site settings.');
  return s;
}

async function getConfig() {
  let config = await getJSON(CONFIG_STORE, CONFIG_KEY);
  if (!config) {
    const stores = {};
    for (const [key, s] of Object.entries(DEFAULT_STORES)) {
      stores[key] = {
        name: s.name,
        pinHash: bcrypt.hashSync(s.pin, 10),
        budgets: emptyBudgets(), // per-category monthly budget $, set in Admin > Stores
        active: true,
      };
    }
    const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
    config = {
      storeOrder: Object.keys(DEFAULT_STORES),
      stores,
      adminPasswordHash: bcrypt.hashSync(adminPassword, 10),
    };
    await setJSON(CONFIG_STORE, CONFIG_KEY, config);
  }
  return config;
}

async function saveConfig(config) {
  await setJSON(CONFIG_STORE, CONFIG_KEY, config);
}

function signStoreToken(storeKey) {
  return jwt.sign({ role: 'store', storeKey }, secret(), { expiresIn: '30d' });
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, secret(), { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch (e) {
    return null;
  }
}

function getBearerToken(event) {
  const h = event.headers.authorization || event.headers.Authorization || '';
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

function requireStore(event) {
  const token = getBearerToken(event);
  const payload = token && verifyToken(token);
  if (!payload || (payload.role !== 'store' && payload.role !== 'admin')) return null;
  return payload;
}

function requireAdmin(event) {
  const token = getBearerToken(event);
  const payload = token && verifyToken(token);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

module.exports = {
  getConfig,
  saveConfig,
  signStoreToken,
  signAdminToken,
  verifyToken,
  requireStore,
  requireAdmin,
  bcrypt,
};
