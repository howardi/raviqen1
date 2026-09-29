// Read the first worksheet as source rows; later sheets may contain notes or answer keys.
// XLSX is a ZIP of XML files. Read only the entries needed for values and headers.
async function unzipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("Invalid XLSX file");
  let cursor = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true);
  const entries = {};
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Invalid XLSX index");
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 20, true);
    const nameSize = view.getUint16(cursor + 28, true);
    const extra = view.getUint16(cursor + 30, true);
    const comment = view.getUint16(cursor + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (name === "xl/sharedStrings.xml" || name === "xl/workbook.xml" || name === "xl/_rels/workbook.xml.rels" || name.startsWith("xl/worksheets/") && name.endsWith(".xml")) {
      const local = view.getUint32(cursor + 42, true);
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const compressed = bytes.subarray(start, start + size);
      if (method === 0) entries[name] = new TextDecoder().decode(compressed);
      else if (method === 8) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        entries[name] = await new Response(stream).text();
      } else throw new Error("Unsupported XLSX compression");
    }
    cursor += 46 + nameSize + extra + comment;
  }
  return entries;
}

function columnIndex(address) {
  const letters = (address.match(/^[A-Z]+/i) || [""])[0].toUpperCase();
  return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export async function readXlsxRows(buffer) {
  const entries = await unzipEntries(buffer);
  const parse = (xml) => new DOMParser().parseFromString(xml, "application/xml");
  const workbook = entries["xl/workbook.xml"] ? parse(entries["xl/workbook.xml"]) : null;
  const relationshipId = workbook?.getElementsByTagName("sheet")[0]?.getAttribute("r:id");
  const relationships = entries["xl/_rels/workbook.xml.rels"] ? parse(entries["xl/_rels/workbook.xml.rels"]) : null;
  const relation = [...(relationships?.getElementsByTagName("Relationship") || [])].find((r) => r.getAttribute("Id") === relationshipId);
  const target = relation?.getAttribute("Target") || "worksheets/sheet1.xml";
  const sheetPath = target.startsWith("/xl/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const sheetXML = entries[sheetPath];
  if (!sheetXML) throw new Error("No first worksheet found in XLSX file");
  const shared = entries["xl/sharedStrings.xml"]
    ? [...parse(entries["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((si) =>
        [...si.getElementsByTagName("t")].map((t) => t.textContent).join(""))
    : [];
  const sheet = parse(sheetXML);
  if (sheet.getElementsByTagName("parsererror").length) throw new Error("Invalid worksheet XML");
  const rows = [...sheet.getElementsByTagName("row")].map((row) => {
    const values = [];
    for (const cell of row.getElementsByTagName("c")) {
      const index = columnIndex(cell.getAttribute("r") || "");
      if (index < 0) continue;
      const raw = cell.getElementsByTagName("v")[0]?.textContent;
      const inline = cell.getElementsByTagName("is")[0];
      values[index] = cell.getAttribute("t") === "s" ? (shared[Number(raw)] ?? "")
        : inline ? [...inline.getElementsByTagName("t")].map((t) => t.textContent).join("")
        : raw ?? "";
    }
    return values;
  }).filter((row) => row.some((v) => v != null && String(v).trim()));
  if (rows.length < 2) return [];
  const headers = rows.shift().map((h) => String(h || "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, values[i] ?? ""])));
}