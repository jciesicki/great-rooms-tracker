function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(1)}%`;
}

function monthLabel(month) {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function buildAwardEmailHtml({ month, storeNames, som, collections, salesperson }) {
  const somWinnerName = storeNames[som.winner] || som.winner;
  const collectionsWinnerName = storeNames[collections.winner] || collections.winner;
  const label = monthLabel(month);

  const rankRow = (title, totals, storeNames) => {
    const rows = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([key, pts], i) => `
        <tr>
          <td style="padding:6px 12px;color:${i === 0 ? '#1a7a3c' : '#555'};font-weight:${i === 0 ? '700' : '400'};">
            ${i === 0 ? '🏆 ' : ''}${storeNames[key] || key}
          </td>
          <td style="padding:6px 12px;text-align:right;color:${i === 0 ? '#1a7a3c' : '#555'};font-weight:${i === 0 ? '700' : '400'};">
            ${pts.toFixed(0)} pts
          </td>
        </tr>`
      )
      .join('');
    return `
      <h3 style="margin:24px 0 8px;color:#1c3d5a;font-family:Arial,sans-serif;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;background:#f7f9fb;border-radius:8px;overflow:hidden;">${rows}</table>`;
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#eef2f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8ee;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="display:inline-block;width:0;height:0;border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:26px solid #3aa15c;"></div>
      </div>
      <div style="text-align:center;color:#1565c0;font-size:26px;font-weight:800;letter-spacing:1px;">GREAT ROOMS</div>
      <div style="text-align:center;color:#3aa15c;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:24px;">SALES &amp; LEASE PURCHASE</div>

      <div style="text-align:center;color:#8a97a3;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${label}</div>
      <div style="text-align:center;color:#1c3d5a;font-size:22px;font-weight:800;margin-bottom:24px;">Store of the Month Awards</div>

      <div style="background:linear-gradient(135deg,#3aa15c,#2c8a4a);border-radius:12px;padding:20px;text-align:center;margin-bottom:8px;">
        <div style="color:#eafff0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Store of the Month</div>
        <div style="color:#ffffff;font-size:28px;font-weight:800;margin-top:4px;">${somWinnerName}</div>
        <div style="color:#eafff0;font-size:13px;margin-top:4px;">${som.totals[som.winner].toFixed(0)} points</div>
      </div>

      ${
        salesperson
          ? `
      <div style="background:linear-gradient(135deg,#1565c0,#0d4b96);border-radius:12px;padding:20px;text-align:center;margin-bottom:8px;">
        <div style="color:#e3f0ff;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Salesperson of the Month</div>
        <div style="color:#ffffff;font-size:28px;font-weight:800;margin-top:4px;">${salesperson.name}</div>
        <div style="color:#e3f0ff;font-size:13px;margin-top:4px;">${salesperson.rents} rents &middot; ${storeNames[salesperson.storeKey] || salesperson.storeKey}</div>
      </div>`
          : ''
      }

      <div style="background:linear-gradient(135deg,#c98a1c,#a86e0f);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;">
        <div style="color:#fff3dc;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Collections of the Month</div>
        <div style="color:#ffffff;font-size:28px;font-weight:800;margin-top:4px;">${collectionsWinnerName}</div>
        <div style="color:#fff3dc;font-size:13px;margin-top:4px;">${collections.totals[collections.winner].toFixed(0)} points</div>
      </div>

      ${rankRow('Store of the Month — full standings', som.totals, storeNames)}
      ${rankRow('Collections of the Month — full standings', collections.totals, storeNames)}

      <div style="text-align:center;color:#a4afb8;font-size:11px;margin-top:28px;">
        Generated automatically by the Great Rooms daily tracker.
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildAwardEmailHtml, monthLabel, fmtMoney, fmtPct };
