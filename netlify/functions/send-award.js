const { Resend } = require('resend');
const { getJSON } = require('../../lib/blobs');
const { requireAdmin, getConfig } = require('../../lib/auth');
const { buildAwardEmailHtml, monthLabel } = require('../../lib/awardEmail');

const SOM_STORE = 'som';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Admin only' });

  const { month } = JSON.parse(event.body || '{}');
  if (!month) return json(400, { error: 'month is required (YYYY-MM)' });

  const record = await getJSON(SOM_STORE, month);
  if (!record || !record.finalized) {
    return json(422, { error: 'This month has not been finalized yet. Review and finalize it in the Store of the Month screen first.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.AWARD_EMAIL_TO;
  const from = process.env.AWARD_EMAIL_FROM || 'Great Rooms Tracker <onboarding@resend.dev>';
  if (!apiKey) return json(500, { error: 'RESEND_API_KEY is not set in Netlify environment variables.' });
  if (!to) return json(500, { error: 'AWARD_EMAIL_TO is not set in Netlify environment variables.' });

  const config = await getConfig();
  const storeNames = Object.fromEntries(config.storeOrder.map((k) => [k, config.stores[k].name]));

  const html = buildAwardEmailHtml({
    month,
    storeNames,
    som: record.som,
    collections: record.collections,
    salesperson: record.salesperson,
  });

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `🏆 Great Rooms — ${monthLabel(month)} Store of the Month`,
      html,
    });
    if (error) return json(502, { error: error.message || String(error) });
    return json(200, { ok: true, id: data?.id });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
