// Store of the Month scoring engine.
//
// Reverse-engineered from Josh's SOM.xlsx: for each metric, rank every store
// best-to-worst and hand out points on an evenly-spaced scale (30/20/10 for
// three stores; the Collections tab weights % Collected on a 50/30/10 scale
// instead). Ties split the points those ranks would have earned.
//
// This generalizes past 3 stores automatically: for N stores the standard
// scale is [10N, 10(N-1), ..., 10], so a 4th store makes it 40/30/20/10.

function rankPoints(valuesByStore, { lowerIsBetter = false, scaleTop = null } = {}) {
  const entries = Object.entries(valuesByStore).filter(
    ([, v]) => v !== null && v !== undefined && !Number.isNaN(v)
  );
  const n = entries.length;
  const points = {};
  if (n === 0) return points;

  const top = scaleTop || n * 10;
  const bottom = 10;
  const step = n > 1 ? (top - bottom) / (n - 1) : 0;
  const scale = Array.from({ length: n }, (_, i) => Math.round(bottom + (n - 1 - i) * step));

  const sorted = [...entries].sort((a, b) => (lowerIsBetter ? a[1] - b[1] : b[1] - a[1]));

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j++;
    // Ranks i..j (0-indexed) are tied; average their scale points.
    const avg = scale.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1);
    for (let k = i; k <= j; k++) points[sorted[k][0]] = avg;
    i = j + 1;
  }
  return points;
}

// Store of the Month metric list. Each entry pulls a value per store out of
// the combined month record (see api/som-compute.js for how that record is
// assembled from daily entries + EOM entries + the parsed Daily Report).
const SOM_METRICS = [
  { key: 'parrGrowth', label: 'PARR Growth', lowerIsBetter: false },
  { key: 'customerGrowth', label: 'Customer Growth', lowerIsBetter: false },
  { key: 'pctCollected', label: '% Collected', lowerIsBetter: false },
  { key: 'newCustomers', label: 'New Customers', lowerIsBetter: false },
  { key: 'tripFeeRate', label: 'Trip Fee Rate', lowerIsBetter: false },
  { key: 'clubFeeRate', label: 'Club Fee Rate', lowerIsBetter: false },
  { key: 'agreementFeeRate', label: 'Agreement Fee Rate', lowerIsBetter: false },
  { key: 'renewalFeeRate', label: 'Renewal Fee Rate', lowerIsBetter: false },
  { key: 'saturdayClose', label: 'Saturday Close %', lowerIsBetter: true },
  { key: 'ytdParrGrowth', label: 'YTD PARR Growth', lowerIsBetter: false },
];

// Collections of the Month metric list (separate tab in the spreadsheet).
const COLLECTIONS_METRICS = [
  { key: 'saturdayClose', label: 'Saturday Close %', lowerIsBetter: true },
  { key: 'saturdayOverPct', label: 'Saturday Over 15%', lowerIsBetter: true },
  { key: 'customerGrowth', label: 'Customer Growth', lowerIsBetter: false },
  { key: 'pctCollected', label: '% Collected', lowerIsBetter: false, scaleTop50: true },
  { key: 'mondayClose', label: 'Monday Close %', lowerIsBetter: true },
];

function computeStoreOfTheMonth(dataByStore) {
  const storeKeys = Object.keys(dataByStore);
  const breakdown = {}; // metricKey -> { storeKey: points }
  const totals = Object.fromEntries(storeKeys.map((k) => [k, 0]));

  for (const metric of SOM_METRICS) {
    const values = Object.fromEntries(storeKeys.map((k) => [k, dataByStore[k]?.[metric.key]]));
    const pts = rankPoints(values, { lowerIsBetter: metric.lowerIsBetter });
    breakdown[metric.key] = pts;
    for (const [k, p] of Object.entries(pts)) totals[k] += p;
  }

  const winner = storeKeys.reduce((a, b) => (totals[b] > totals[a] ? b : a), storeKeys[0]);
  return { metrics: SOM_METRICS, breakdown, totals, winner };
}

function computeCollectionsOfTheMonth(dataByStore) {
  const storeKeys = Object.keys(dataByStore);
  const breakdown = {};
  const totals = Object.fromEntries(storeKeys.map((k) => [k, 0]));

  for (const metric of COLLECTIONS_METRICS) {
    const values = Object.fromEntries(storeKeys.map((k) => [k, dataByStore[k]?.[metric.key]]));
    const n = storeKeys.length;
    const scaleTop = metric.scaleTop50 ? 50 : n * 10;
    const pts = rankPoints(values, { lowerIsBetter: metric.lowerIsBetter, scaleTop });
    breakdown[metric.key] = pts;
    for (const [k, p] of Object.entries(pts)) totals[k] += p;
  }

  const winner = storeKeys.reduce((a, b) => (totals[b] > totals[a] ? b : a), storeKeys[0]);
  return { metrics: COLLECTIONS_METRICS, breakdown, totals, winner };
}

function computeSalespersonOfTheMonth(salespeople) {
  // salespeople: [{ name, storeKey, rents }]
  if (!salespeople || salespeople.length === 0) return null;
  return salespeople.reduce((a, b) => (b.rents > a.rents ? b : a));
}

module.exports = {
  rankPoints,
  SOM_METRICS,
  COLLECTIONS_METRICS,
  computeStoreOfTheMonth,
  computeCollectionsOfTheMonth,
  computeSalespersonOfTheMonth,
};
