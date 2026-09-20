const { blobStore } = require('../../lib/blobs');
const { requireAdmin } = require('../../lib/auth');

// Admin-only file download, for reviewing uploaded EOM checklist photos/PDFs.
exports.handler = async (event) => {
  try {
    const auth = requireAdmin(event);
    if (!auth) return { statusCode: 401, body: 'Unauthorized' };

    const fileId = (event.queryStringParameters || {}).id;
    if (!fileId) return { statusCode: 400, body: 'id is required' };

    const store = blobStore('files');
    const [data, metadata] = await Promise.all([
      store.get(fileId, { type: 'arrayBuffer' }),
      store.getMetadata(fileId),
    ]);
    if (!data) return { statusCode: 404, body: 'Not found' };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': metadata?.metadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${metadata?.metadata?.filename || fileId}"`,
      },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
