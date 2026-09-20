const crypto = require('crypto');
const { extractTableText } = require('../../lib/pdfText');
const { blobStore, getJSON, setJSON } = require('../../lib/blobs');
const { requireAdmin } = require('../../lib/auth');
const { parseDailyReport } = require('../../lib/dailyReportParser');

const REPORT_STORE = 'dailyreport';

function monthFromDate(dateStr) {
  // dateStr like "8/31/2026"
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr || '');
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}`;
}

exports.handler = async (event) => {
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Admin only' });

  if (event.httpMethod === 'GET') {
    const month = (event.queryStringParameters || {}).month;
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });
    const record = await getJSON(REPORT_STORE, month);
    return json(200, record || null);
  }

  if (event.httpMethod === 'POST') {
    try {
      const { filename, base64, month: overrideMonth } = JSON.parse(event.body || '{}');
      if (!base64) return json(400, { error: 'base64 is required' });
      const buffer = Buffer.from(base64, 'base64');

      const text = await extractTableText(buffer);
      const result = parseDailyReport(text);
      if (!result.ok) return json(422, { error: result.error, rawTextSample: parsed.text.slice(0, 500) });

      const month = overrideMonth || monthFromDate(result.reportDate);
      if (!month) return json(422, { error: 'Could not determine the report month from the PDF date. Pass "month" explicitly (YYYY-MM).' });

      const fileId = crypto.randomUUID();
      await blobStore('files').set(fileId, buffer, {
        metadata: { filename: filename || 'daily-report.pdf', contentType: 'application/pdf', uploadedBy: 'admin' },
      });

      const record = { ...result, month, fileId, savedAt: new Date().toISOString() };
      await setJSON(REPORT_STORE, month, record);
      return json(200, record);
    } catch (e) {
      return json(500, { error: e.message });
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
