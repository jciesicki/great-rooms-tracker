// pdf-parse's default text extraction just concatenates each page's text
// runs in the order pdf.js emits them, with no guarantee that runs from the
// same visual row stay adjacent or spaced apart -- fine for prose, useless
// for a table like the Daily Report (numbers end up glued together with no
// separating space). This reconstructs real rows by grouping text items
// with (near-)matching Y position and ordering them left-to-right by X.
const pdfParse = require('pdf-parse');

const Y_TOLERANCE = 2.5;

async function tableAwareRender(pageData) {
  const textContent = await pageData.getTextContent();
  const items = textContent.items.filter((i) => i.str !== undefined);

  // Sort top-to-bottom (PDF y grows upward), then left-to-right.
  items.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

  const rows = [];
  let current = null;
  let currentY = null;
  for (const item of items) {
    const y = item.transform[5];
    if (current === null || Math.abs(y - currentY) > Y_TOLERANCE) {
      current = [];
      rows.push(current);
      currentY = y;
    }
    current.push(item);
  }

  return rows
    .map((row) => row.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(' '))
    .join('\n');
}

async function extractTableText(buffer) {
  const result = await pdfParse(buffer, { pagerender: tableAwareRender });
  return result.text;
}

module.exports = { extractTableText };
