const crypto = require('crypto');
const { blobStore } = require('../../lib/blobs');
const { requireStore } = require('../../lib/auth');

// Generic file upload used for storing EOM checklist photos/PDFs as an
// audit trail. Body: { filename, contentType, base64 }. Returns { fileId }.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const auth = requireStore(event);
  if (!auth) return json(401, { error: 'Unauthorized' });

  try {
    const { filename, contentType, base64 } = JSON.parse(event.body || '{}');
    if (!base64) return json(400, { error: 'base64 is required' });

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 15 * 1024 * 1024) return json(413, { error: 'File too large (15MB max)' });

    const fileId = crypto.randomUUID();
    const store = blobStore('files');
    await store.set(fileId, buffer, {
      metadata: { filename: filename || fileId, contentType: contentType || 'application/octet-stream', uploadedBy: auth.storeKey || 'admin' },
    });
    return json(200, { fileId });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
