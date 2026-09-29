// Minimal, dependency-free .docx (Office Open XML) generator.
// A .docx is a ZIP archive of XML parts. We build it with "stored" (uncompressed)
// entries so no compression library is required — only a CRC32 + ZIP writer.

// --- CRC32 (IEEE 802.3 polynomial) -----------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Stored-only ZIP writer ------------------------------------------------
function buildZip(entries) {
  // entries: [{ name: string, data: Uint8Array }]
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method = stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x21, true); // mod date (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // compressed size
    lv.setUint32(22, data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, 0, true); // time
    cv.setUint16(14, 0x21, true); // date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length + data.length;
  }

  const cdSize = centrals.reduce((s, h) => s + h.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total =
    locals.reduce((s, h) => s + h.length, 0) +
    entries.reduce((s, e) => s + e.data.length, 0) +
    cdSize +
    eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (let i = 0; i < entries.length; i++) {
    out.set(locals[i], pos);
    pos += locals[i].length;
    out.set(entries[i].data, pos);
    pos += entries[i].data.length;
  }
  for (let i = 0; i < entries.length; i++) {
    out.set(centrals[i], pos);
    pos += centrals[i].length;
  }
  out.set(eocd, pos);
  return out;
}

// --- OOXML helpers ---------------------------------------------------------
function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// half-points: pt size * 2
function run(text, opts = {}) {
  const rPr = [];
  if (opts.bold) rPr.push("<w:b/>");
  if (opts.italic) rPr.push("<w:i/>");
  if (opts.color) rPr.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.size) rPr.push(`<w:sz w:val="${opts.size * 2}"/>`);
  const rPrXml = rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(text, opts = {}) {
  const pPr = [];
  if (opts.spacing) pPr.push(`<w:spacing w:after="${opts.spacing}" w:line="276" w:lineRule="auto"/>`);
  if (opts.heading) pPr.push(`<w:pStyle w:val="Heading1"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${run(text, opts)}</w:p>`;
}

function emptyPara() {
  return `<w:p/>`;
}

// Build the word/document.xml body from structured content.
// content: array of blocks: { type: "title"|"heading"|"body"|"list"|"tip", ... }
function buildDocumentXml(content, useWatermark = false) {
  const bodyParts = [];
  for (const block of content) {
    if (block.type === "title") {
      bodyParts.push(paragraph(block.text, { bold: true, size: 26, color: "231F20", spacing: 120 }));
    } else if (block.type === "subtitle") {
      bodyParts.push(paragraph(block.text, { size: 14, color: "14A48E", spacing: 80 }));
    } else if (block.type === "muted") {
      bodyParts.push(paragraph(block.text, { size: 10, color: "999999", spacing: 60 }));
    } else if (block.type === "heading") {
      bodyParts.push(paragraph(block.text, { bold: true, size: 14, color: "231F20", spacing: 160 }));
    } else if (block.type === "body") {
      bodyParts.push(paragraph(block.text, { size: 11, color: "333333", spacing: 120 }));
    } else if (block.type === "list") {
      block.items.forEach((item, i) => {
        bodyParts.push(paragraph(`${i + 1}. ${item}`, { size: 11, color: "333333", spacing: 80 }));
      });
    } else if (block.type === "bullets") {
      block.items.forEach((item) => {
        bodyParts.push(paragraph(`• ${item}`, { size: 11, color: "333333", spacing: 80 }));
      });
    } else if (block.type === "tip") {
      bodyParts.push(paragraph(`TIP: ${block.text}`, { bold: true, size: 10, color: "14A48E", spacing: 120 }));
    } else if (block.type === "spacer") {
      bodyParts.push(emptyPara());
    }
  }
  const headerRef = useWatermark ? `<w:headerReference w:type="default" r:id="rId2"/>` : "";
  bodyParts.push(`<w:sectPr>${headerRef}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyParts.join("")}</w:body></w:document>`;
}

// Centered logo watermark applied via the default page header so it repeats on
// every page. Uses modern DrawingML (wp:anchor behind text) with a 25% alpha
// modifier so the watermark renders in both Microsoft Word and iOS Pages.
// EMU = 914400 per inch; cap the longest edge at ~3.2in for a centered watermark.
const WATERMARK_MAX_EMU = 2926080; // 3.2in

function pngDimensions(bytes) {
  // PNG: 8-byte signature, then IHDR chunk (4-byte length, "IHDR", 4-byte width, 4-byte height)
  if (!bytes || bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x89504e47) return null; // PNG signature
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height) return null;
  return { width, height };
}

function buildHeaderXml(cx, cy) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeFrom="page" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH><wp:positionV relativeFrom="page"><wp:align>center</wp:align></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="RAVIQEN Watermark"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="RAVIQEN Watermark"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"><a:alphaModFix amt="25000"/></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p></w:hdr>`;
}

const HEADER_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/watermark.png"/></Relationships>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`;

// content: array of blocks (see buildDocumentXml). Returns a Blob (application/vnd.openxmlformats-officedocument.wordprocessingml.document).
export function buildDocxBlob(content, watermarkBytes) {
  const enc = new TextEncoder();
  const documentXml = buildDocumentXml(content, !!watermarkBytes);
  const entries = [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: enc.encode(RELS_XML) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
    { name: "word/styles.xml", data: enc.encode(STYLES_XML) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(WORD_RELS_XML) },
  ];
  if (watermarkBytes) {
    // Scale the logo so its longest edge fits the watermark size, preserving aspect ratio.
    let cx = WATERMARK_MAX_EMU;
    let cy = WATERMARK_MAX_EMU;
    const dims = pngDimensions(watermarkBytes);
    if (dims) {
      const scale = WATERMARK_MAX_EMU / Math.max(dims.width, dims.height);
      cx = Math.round(dims.width * scale);
      cy = Math.round(dims.height * scale);
    }
    entries.push({ name: "word/header1.xml", data: enc.encode(buildHeaderXml(cx, cy)) });
    entries.push({ name: "word/_rels/header1.xml.rels", data: enc.encode(HEADER_RELS_XML) });
    entries.push({ name: "word/media/watermark.png", data: watermarkBytes });
  }
  const zipBytes = buildZip(entries);
  return new Blob([zipBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}