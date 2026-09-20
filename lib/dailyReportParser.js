// Parses the text layer of the "GR DAILY REPORT" PDF (the typed, computer-
// generated company-wide report -- not the handwritten EOM checklist).
//
// The report lists one line per metric with the label followed by one
// number per store, e.g.:
//   MTD PARR GAIN ($2,382) ($711) ($2,590) $732 $1,651 $853 ($710) ($4,474) ($335)
//
// Store order varies by report (locations get added), so we don't hardcode
// column positions -- instead we read the row of first-name salespeople
// codes right under the header to count stores, and match known store-code
// aliases in the header line to figure out which column is which.

const KNOWN_CODES = [
  ['lakeland', ['LAKELAND']],
  ['winterhaven', ['W HAVEN', 'WTR HAVEN', 'WINTER HAVEN']],
  ['clearwater', ['CLWTR', 'CLEARWATER', 'CLW']],
  ['tampa', ['TAMPA']],
  ['pasco', ['PASCO']],
  ['konig', ['KONIG']],
  ['pinehills', ['PINE HILLS']],
  ['springhill', ['SPRING HILL']],
  ['kissimmee', ['KISSIMMEE']],
  ['ptn', ['PTN']],
];

const METRIC_LINES = {
  newCustomersMtd: 'NEW CUSTOMERS MTD',
  currentCustomers: 'CURRENT CUSTOMERS',
  customerGrowth: 'MTD CUSTOMER GAIN',
  ytdCustomerGrowth: 'YTD CUSTOMER GAIN',
  currentBor: 'CURRENT BOR',
  mtdClubs: 'MTD CLUBS',
  currentParr: 'CURRENT PARR',
  parrGrowth: 'MTD PARR GAIN',
  ytdParrGrowth: 'YTD PARR GAIN',
  mtdDeposit: 'MTD DEPOSIT',
  budgetedGm: 'BUDGETED GM',
  gmCollected: 'GM COLLECTED',
  pctCollected: '% GM COLLECTED',
};

const NUM_TOKEN = /\(?-?\$?[\d,]+(?:\.\d+)?%?\)?/g;

function parseNumberToken(tok) {
  const neg = tok.startsWith('(') && tok.endsWith(')');
  let s = tok.replace(/[()$,%]/g, '');
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

function findStoreColumns(headerLine, nameCount) {
  const found = [];
  for (const [storeKey, aliases] of KNOWN_CODES) {
    for (const alias of aliases) {
      const idx = headerLine.toUpperCase().indexOf(alias);
      if (idx !== -1) {
        found.push({ storeKey, idx });
        break;
      }
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  return found.slice(0, nameCount).map((f) => f.storeKey);
}

function parseDailyReport(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Header line has the store codes; the very next non-empty line is the
  // one-name-per-store salesperson row, used to count stores reliably.
  const headerIdx = lines.findIndex((l) => /LAKELAND/i.test(l));
  if (headerIdx === -1) {
    return { ok: false, error: 'Could not find a header row with store codes (looked for "LAKELAND").' };
  }
  const headerLine = lines[headerIdx];
  const nameLine = lines[headerIdx + 1] || '';
  const nameCount = nameLine.split(/\s+/).filter(Boolean).length;
  if (nameCount < 1) {
    return { ok: false, error: 'Could not find the salesperson-name row under the header to count stores.' };
  }

  const storeOrder = findStoreColumns(headerLine, nameCount);

  const dateMatch = text.match(/'?(\d{1,2}\/\d{1,2}\/\d{4})'?\s*DAILY REPORT/i);
  const reportDate = dateMatch ? dateMatch[1] : null;

  const byStore = {};
  for (const key of storeOrder) byStore[key] = {};

  const warnings = [];
  for (const [field, label] of Object.entries(METRIC_LINES)) {
    const line = lines.find((l) => l.toUpperCase().startsWith(label.toUpperCase()));
    if (!line) {
      warnings.push(`Metric line not found: ${label}`);
      continue;
    }
    const rest = line.slice(label.length);
    const tokens = rest.match(NUM_TOKEN) || [];
    if (tokens.length < storeOrder.length) {
      warnings.push(`Expected ${storeOrder.length} values for "${label}", found ${tokens.length}`);
    }
    storeOrder.forEach((storeKey, i) => {
      const raw = tokens[i];
      byStore[storeKey][field] = raw !== undefined ? parseNumberToken(raw) : null;
    });
  }

  return { ok: true, reportDate, storeOrder, byStore, warnings };
}

module.exports = { parseDailyReport, KNOWN_CODES };
