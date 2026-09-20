// The 7 revenue-tracker categories, shared by daily entry, store budgets,
// the admin dashboard, and the Store of the Month fee-rate calculation.
const REVENUE_CATEGORIES = [
  { key: 'rentalRevenue', label: 'Rental Revenue' },
  { key: 'damageWaivers', label: 'Damage Waivers' },
  { key: 'renewalFees', label: 'Renewal Fees' },
  { key: 'agreementFees', label: 'Agreement Fees' },
  { key: 'clubFees', label: 'Club Fees' },
  { key: 'ihcFees', label: 'IHC Fees (Trip Fee)' },
  { key: 'cashSales', label: 'Cash Sales' },
];

function emptyBudgets() {
  return Object.fromEntries(REVENUE_CATEGORIES.map((c) => [c.key, 0]));
}

module.exports = { REVENUE_CATEGORIES, emptyBudgets };
