const { getJSON, setJSON, listKeys } = require('../../lib/blobs');
const { requireAdmin, getConfig } = require('../../lib/auth');
const {
  computeStoreOfTheMonth,
  computeCollectionsOfTheMonth,
  computeSalespersonOfTheMonth,
} = require('../../lib/scoring');

const DAILY_STORE = 'daily';
const EOM_STORE = 'eom';
const REPORT_STORE = 'dailyreport';
const SOM_STORE = 'som';

// Pulls the last (highest-day-number) daily entry saved for a store/month --
// that's the store's most complete revenue-tracker snapshot for the month.
async function lastDailyEntry(storeKey, month) {
  const keys = await listKeys(DAILY_STORE, `${storeKey}/${month}/`);
  let best = null;
  for (const k of keys) {
    if (k.endsWith('/begin')) continue;
    const entry = await getJSON(DAILY_STORE, k);
    if (entry && (!best || entry.day > best.day)) best = entry;
  }
  return best;
}

// Builds the per-store metric bundle the scoring engine needs. Trip Fee,
// Club Fee, Agreement Fee and Renewal Fee are each that category's % of
// Budget at month end (actual $ from the last daily entry / that store's
// budgeted $ for the category, from Admin > Stores) -- confirmed against
// Josh's SOM.xlsx: "Trip Fee" is the IHC Fees line's % of Budget.
async function assembleMonthData(month, storeKeys, storesConfig, overrides = {}) {
  const report = await getJSON(REPORT_STORE, month);
  const dataByStore = {};
  const salespeople = [];
  const suggestions = {}; // auto-computed % of budget; admin can still override before finalizing

  for (const storeKey of storeKeys) {
    const rpt = report?.byStore?.[storeKey] || {};
    const eom = await getJSON(EOM_STORE, `${month}/${storeKey}`);
    const daily = await lastDailyEntry(storeKey, month);
    const budgets = storesConfig[storeKey]?.budgets || {};

    const pctOfBudget = (actual, budget) => (actual !== undefined && actual !== null && budget) ? (actual / budget) * 100 : null;

    const suggested = {
      tripFeeRate: pctOfBudget(daily?.ihcFees, budgets.ihcFees),
      clubFeeRate: pctOfBudget(daily?.clubFees, budgets.clubFees),
      agreementFeeRate: pctOfBudget(daily?.agreementFees, budgets.agreementFees),
      renewalFeeRate: pctOfBudget(daily?.renewalFees, budgets.renewalFees),
    };
    suggestions[storeKey] = suggested;

    const o = overrides[storeKey] || {};
    dataByStore[storeKey] = {
      parrGrowth: rpt.parrGrowth ?? null,
      customerGrowth: rpt.customerGrowth ?? null,
      pctCollected: rpt.pctCollected ?? null,
      newCustomers: rpt.newCustomersMtd ?? null,
      ytdParrGrowth: rpt.ytdParrGrowth ?? null,
      saturdayClose: eom?.saturdayClosePct ?? null,
      saturdayOverPct: eom?.saturdayOverPct ?? null,
      mondayClose: eom?.mondayClosePct ?? null,
      tripFeeRate: o.tripFeeRate ?? suggested.tripFeeRate,
      clubFeeRate: o.clubFeeRate ?? suggested.clubFeeRate,
      agreementFeeRate: o.agreementFeeRate ?? suggested.agreementFeeRate,
      renewalFeeRate: o.renewalFeeRate ?? suggested.renewalFeeRate,
    };

    for (const a of eom?.associates || []) {
      salespeople.push({ name: a.name, storeKey, rents: a.rents });
    }
  }

  return { dataByStore, salespeople, suggestions, reportFound: !!report };
}

exports.handler = async (event) => {
  try {
  const auth = requireAdmin(event);
  if (!auth) return json(401, { error: 'Admin only' });

  const config = await getConfig();
  const activeStores = config.storeOrder.filter((k) => config.stores[k]?.active);

  if (event.httpMethod === 'GET') {
    const month = (event.queryStringParameters || {}).month;
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });

    const saved = await getJSON(SOM_STORE, month);
    let previewOverrides = null;
    if ((event.queryStringParameters || {}).overrides) {
      try {
        previewOverrides = JSON.parse(event.queryStringParameters.overrides);
      } catch (e) {
        return json(400, { error: 'overrides query param must be valid JSON' });
      }
    }
    const { dataByStore, salespeople, suggestions, reportFound } = await assembleMonthData(
      month,
      activeStores,
      config.stores,
      previewOverrides || saved?.overrides || {}
    );

    const som = computeStoreOfTheMonth(dataByStore);
    const collections = computeCollectionsOfTheMonth(dataByStore);
    const salesperson = computeSalespersonOfTheMonth(salespeople);

    return json(200, {
      month,
      storeNames: Object.fromEntries(activeStores.map((k) => [k, config.stores[k].name])),
      reportFound,
      dataByStore,
      suggestions,
      salespeople,
      som,
      collections,
      salesperson,
      finalized: !!saved?.finalized,
    });
  }

  if (event.httpMethod === 'POST') {
    // Finalize: persist admin's fee-rate overrides + the computed result so
    // the award email always reflects exactly what was shown on screen.
    const body = JSON.parse(event.body || '{}');
    const { month, overrides } = body;
    if (!month) return json(400, { error: 'month is required (YYYY-MM)' });

    const { dataByStore, salespeople } = await assembleMonthData(month, activeStores, config.stores, overrides || {});
    const som = computeStoreOfTheMonth(dataByStore);
    const collections = computeCollectionsOfTheMonth(dataByStore);
    const salesperson = computeSalespersonOfTheMonth(salespeople);

    const record = {
      month,
      overrides: overrides || {},
      dataByStore,
      som,
      collections,
      salesperson,
      finalized: true,
      finalizedAt: new Date().toISOString(),
    };
    await setJSON(SOM_STORE, month, record);
    return json(200, record);
  }

  return { statusCode: 405, body: 'Method not allowed' };
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
