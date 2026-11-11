/** RFC 4180 CSV: quoted cells may hold commas, quotes ("") and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "$1,256" → 1256. Throws on anything that is not a plain dollar amount. */
export function dollars(value) {
  const text = String(value).trim();
  if (!/^\$\d{1,3}(,\d{3})*$|^\$\d+$/.test(text)) throw new Error(`Not a dollar amount: ${JSON.stringify(value)}`);
  return Number(text.replace(/[$,]/g, ""));
}
