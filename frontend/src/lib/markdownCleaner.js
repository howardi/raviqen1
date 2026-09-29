// Clean markdown to plain text (for CSV/Excel exports) — strips all formatting syntax
export function cleanMarkdownToPlainText(text) {
  if (!text) return "";
  return text
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
    .replace(/^\|(.+)\|\s*$/gm, (m) => m.split("|").map((c) => c.trim()).filter(Boolean).join("  |  "))
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, "─────────────────────────────────────────────")
    .trim();
}

function cleanInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function parseInlineSegments(text) {
  const segments = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), style: "normal" });
    }
    if (match[2]) segments.push({ text: match[2], style: "bold" });
    else if (match[3]) segments.push({ text: match[3], style: "italic" });
    else if (match[4]) segments.push({ text: match[4], style: "normal" });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), style: "normal" });
  }
  return segments.length ? segments : [{ text, style: "normal" }];
}

// Render markdown content into a jsPDF document with proper formatting (no raw symbols)
export function renderMarkdownToPDF(doc, text, startX, startY, maxWidth, options = {}) {
  const { fontSize = 10, lineHeight = 14, pageHeight, margin = 40 } = options;
  let y = startY;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin - 30) {
      doc.addPage();
      y = margin;
    }
  };

  const lines = (text || "").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      ensureSpace(15);
      doc.setDrawColor(200, 200, 200);
      doc.line(startX, y, startX + maxWidth, y);
      y += 12;
      i++;
      continue;
    }

    // Table
    if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("---")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      y = renderTableToPDF(doc, tableLines, startX, y, maxWidth, ensureSpace);
      y += 6;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const sizes = { 1: 16, 2: 13, 3: 11, 4: 10 };
      const size = sizes[level] || 10;
      ensureSpace(size + 12);
      y += 6;
      doc.setFontSize(size);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(35, 31, 32);
      const wrapped = doc.splitTextToSize(cleanInline(headingText), maxWidth);
      wrapped.forEach((l) => {
        ensureSpace(size + 4);
        doc.text(l, startX, y);
        y += size + 4;
      });
      y += 4;
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (bulletMatch) {
      y = renderListItem(doc, "\u2022", bulletMatch[1], startX, y, maxWidth, fontSize, lineHeight, ensureSpace);
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numMatch) {
      y = renderListItem(doc, `${numMatch[1]}.`, numMatch[2], startX, y, maxWidth, fontSize, lineHeight, ensureSpace);
      i++;
      continue;
    }

    // Empty line
    if (trimmed === "") {
      y += lineHeight / 2;
      i++;
      continue;
    }

    // Normal paragraph
    y = renderParagraph(doc, line, startX, y, maxWidth, fontSize, lineHeight, ensureSpace);
    i++;
  }

  return y;
}

function renderListItem(doc, marker, text, startX, y, maxWidth, fontSize, lineHeight, ensureSpace) {
  const indent = 20;
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  ensureSpace(lineHeight);
  doc.text(marker, startX + 4, y);

  const segments = parseInlineSegments(text);
  let currentX = startX + indent;
  for (const seg of segments) {
    doc.setFont("helvetica", seg.style === "bold" ? "bold" : "normal");
    doc.setTextColor(seg.style === "bold" ? 35 : 60, seg.style === "bold" ? 31 : 60, seg.style === "bold" ? 32 : 60);
    const words = seg.text.split(" ");
    for (let w = 0; w < words.length; w++) {
      const word = words[w] + (w < words.length - 1 ? " " : "");
      const wordWidth = doc.getTextWidth(word);
      if (currentX + wordWidth > startX + maxWidth && currentX > startX + indent) {
        ensureSpace(lineHeight);
        y += lineHeight;
        currentX = startX + indent;
      }
      doc.text(word, currentX, y);
      currentX += wordWidth;
    }
  }
  y += lineHeight;
  return y;
}

function renderParagraph(doc, text, startX, y, maxWidth, fontSize, lineHeight, ensureSpace) {
  const segments = parseInlineSegments(text);
  doc.setFontSize(fontSize);
  let currentX = startX;

  for (const seg of segments) {
    doc.setFont("helvetica", seg.style === "bold" ? "bold" : "normal");
    doc.setTextColor(seg.style === "bold" ? 35 : 60, seg.style === "bold" ? 31 : 60, seg.style === "bold" ? 32 : 60);
    const words = seg.text.split(" ");
    for (let w = 0; w < words.length; w++) {
      const word = words[w] + (w < words.length - 1 ? " " : "");
      const wordWidth = doc.getTextWidth(word);
      if (currentX + wordWidth > startX + maxWidth && currentX > startX) {
        ensureSpace(lineHeight);
        y += lineHeight;
        currentX = startX;
      }
      ensureSpace(lineHeight);
      doc.text(word, currentX, y);
      currentX += wordWidth;
    }
  }
  y += lineHeight;
  return y;
}

function renderTableToPDF(doc, tableLines, x, y, maxWidth, ensureSpace) {
  const rows = tableLines
    .filter((l) => !l.trim().includes("---"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));

  if (rows.length === 0) return y;

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidth = maxWidth / colCount;
  const rowHeight = 16;

  ensureSpace(rowHeight * (rows.length + 1));

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, maxWidth, rowHeight, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  for (let ci = 0; ci < colCount; ci++) {
    const cell = cleanInline(rows[0][ci] || "");
    const truncated = doc.splitTextToSize(cell, colWidth - 8)[0] || "";
    doc.text(truncated, x + ci * colWidth + 4, y + 11);
  }
  y += rowHeight;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  for (let ri = 1; ri < rows.length; ri++) {
    ensureSpace(rowHeight);
    for (let ci = 0; ci < colCount; ci++) {
      const cell = cleanInline(rows[ri][ci] || "");
      const truncated = doc.splitTextToSize(cell, colWidth - 8)[0] || "";
      doc.text(truncated, x + ci * colWidth + 4, y + 11);
    }
    doc.setDrawColor(220, 220, 220);
    doc.line(x, y, x + maxWidth, y);
    y += rowHeight;
  }

  // Outer border
  doc.setDrawColor(180, 180, 180);
  doc.rect(x, y - rows.length * rowHeight, maxWidth, rows.length * rowHeight);

  return y;
}