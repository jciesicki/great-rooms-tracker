// Thin helpers around Netlify Blobs. Every "store" here is a Netlify Blobs
// store (a namespaced key/value bucket), NOT a Great Rooms location -- to
// keep that straight we always say "blob store" in comments.
const { getStore } = require('@netlify/blobs');

function blobStore(name) {
  // getStore() normally auto-detects siteID/token from the Netlify Functions
  // runtime. Some deploys don't get that context injected, so we fall back
  // to explicit config from env vars (BLOBS_SITE_ID / BLOBS_TOKEN) if set.
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({
      name,
      consistency: 'strong',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
  }
  return getStore({ name, consistency: 'strong' });
}

async function getJSON(storeName, key, fallback = null) {
  const store = blobStore(storeName);
  const val = await store.get(key, { type: 'json' });
  return val === null || val === undefined ? fallback : val;
}

async function setJSON(storeName, key, value) {
  const store = blobStore(storeName);
  await store.setJSON(key, value);
  return value;
}

async function deleteKey(storeName, key) {
  const store = blobStore(storeName);
  await store.delete(key);
}

async function listKeys(storeName, prefix) {
  const store = blobStore(storeName);
  const { blobs } = await store.list({ prefix });
  return blobs.map((b) => b.key);
}

module.exports = { blobStore, getJSON, setJSON, deleteKey, listKeys };
