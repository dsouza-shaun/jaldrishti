/**
 * PDF rendering for the screening report.
 *
 * Uses pdfkit's built-in Helvetica rather than a bundled TTF. That keeps the
 * standalone build free of font binaries and avoids a font licence in the
 * repository, at the cost of WinAnsi coverage, so every string is passed
 * through `safeText` first: the degree sign, superscripts and typographic
 * punctuation are mapped to their nearest ASCII, and anything the built-in
 * encoding cannot represent becomes "?" rather than throwing mid-document.
 */

import PDFDocument from "pdfkit";
import type { ReportSection } from "@/lib/report/sections";
import type { Block, Metric } from "@/lib/report/document";

const INK = "#0a0a0a";
const MUTED = "#5c5c5c";
const RULE = "#c9c2ae";
const ACCENT = "#ff3b3b";

/** Map characters the built-in WinAnsi encoding cannot draw. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/–|—/g, "-"],
  [/…/g, "..."],
  [/°/g, " deg "],
  [/²/g, "2"],
  [/³/g, "3"],
  [/¹/g, "1"],
  [/µ/g, "u"],
  [/×/g, "x"],
  [/≈/g, "~"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/→/g, "->"],
  [/ /g, " "],
  // Devanagari and any other non-Latin script.
  [/[ऀ-ॿ]/g, "?"],
  [/[֐-׿؀-ۿ]/g, "?"],
  // Emoji and pictographs.
  [/\p{Extended_Pictographic}/gu, "?"],
];

export function safeText(value: string): string {
  let out = value;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Drop any remaining character outside Latin-1, which is all Helvetica draws.
  return out.replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "?");
}

const PAGE_MARGIN = 48;

export function renderReportPdf(
  sections: ReportSection[],
  meta: { title: string; subtitle: string; footer: string },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      info: {
        Title: safeText(meta.title),
        Author: "JalDrishti",
        Subject: "Preliminary water feasibility screening",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - PAGE_MARGIN * 2;

    // ---- Cover heading ----------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT);
    doc.text("JALDRISHTI", { characterSpacing: 1.6 });
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").fontSize(19).fillColor(INK);
    doc.text(safeText(meta.title), { lineGap: 2 });
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10).fillColor(MUTED);
    doc.text(safeText(meta.subtitle));
    doc.moveDown(0.8);

    rule(doc, contentWidth);
    doc.moveDown(1);

    // ---- Sections ---------------------------------------------------------
    sections.forEach((section, index) => {
      // Reserve room for the heading *and* the start of its first block. Without
      // the second part a heading can land at the foot of a page while the table
      // that follows is pushed to the next, leaving a sheet holding nothing but
      // a heading and the footer, which reads as a blank page.
      const first = section.blocks[0];
      ensureSpace(doc, HEADING_HEIGHT + (first ? estimateHeight(first, contentWidth) : 0));
      resetX(doc);
      sectionHeading(doc, `${index + 1}. ${section.title}`);
      for (const block of section.blocks) {
        drawBlock(doc, block, contentWidth);
      }
      // A trailing moveDown on the last section can tip the cursor past the
      // bottom margin, which makes pdfkit open a fresh, empty page. Skipping it
      // there avoids a blank sheet at the end of the document.
      if (index < sections.length - 1) {
        if (doc.y < doc.page.height - PAGE_MARGIN - 24) {
          doc.moveDown(0.9);
        }
      }
    });

    // ---- Footer on every page ---------------------------------------------
    // The footer is drawn below the bottom margin, which pdfkit would treat as
    // overflow and answer by inserting a fresh page for each footer, producing
    // a blank page after every sheet. Zeroing the bottom margin for the duration
    // suppresses that auto-pagination while the footer is written.
    const range = doc.bufferedPageRange();
    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 34;
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(safeText(meta.footer), PAGE_MARGIN, y, {
        width: contentWidth - 60,
        lineBreak: false,
        ellipsis: true,
      });
      doc.text(
        `Page ${pageIndex - range.start + 1} of ${range.count}`,
        PAGE_MARGIN + contentWidth - 60,
        y,
        { width: 60, align: "right", lineBreak: false },
      );
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - PAGE_MARGIN - 20) {
    doc.addPage();
  }
}

const HEADING_HEIGHT = 34;

/**
 * Rough vertical cost of a block, used only to decide whether a page break is
 * needed before it starts. It deliberately over-estimates a table, because a
 * table that cannot begin on the current page will move itself entirely to the
 * next one, and guessing low is what produces the orphan heading.
 */
function estimateHeight(block: Block, width: number): number {
  switch (block.kind) {
    case "title":
      return 40;
    case "subtitle":
      return 28;
    case "heading":
      return 34;
    case "paragraph":
      return 60;
    case "note":
      return 50;
    case "divider":
      return 18;
    case "metrics":
      return 96;
    case "list":
      return Math.min(block.items.length * 16 + 12, 220);
    case "table": {
      // Caption, header rule, and enough rows to be worth starting here.
      const perRow = width < 420 ? 26 : 18;
      return 44 + Math.min(block.rows.length, 6) * perRow;
    }
    default:
      return 40;
  }
}

function rule(doc: PDFKit.PDFDocument, width: number, colour = RULE, thickness = 1): void {
  const y = doc.y;
  doc.save().strokeColor(colour).lineWidth(thickness)
    .moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + width, y).stroke().restore();
  doc.y = y + 6;
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
  doc.text(safeText(text), { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 1 });
  const y = doc.y;
  doc.save().strokeColor(INK).lineWidth(1.4)
    .moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + doc.page.width - PAGE_MARGIN * 2, y)
    .stroke().restore();
  doc.moveDown(0.5);
}

/**
 * Returns the text cursor to the left margin.
 *
 * pdfkit advances `doc.x` whenever text is written at an explicit x, which the
 * table and metric helpers do for every cell. Without this reset the next block
 * would start under the last column it rendered, which pushed headings and notes
 * off the right edge of the page. Every helper that positions text absolutely
 * calls this on the way out.
 */
function resetX(doc: PDFKit.PDFDocument): void {
  doc.x = PAGE_MARGIN;
}

function drawBlock(doc: PDFKit.PDFDocument, block: Block, width: number): void {
  // Writing text while the cursor already sits below the bottom margin makes
  // pdfkit open a new page mid-block, which strands the fragment it had already
  // drawn. Every block therefore checks it fits before it starts.
  ensureSpace(doc, estimateHeight(block, width));
  resetX(doc);
  switch (block.kind) {
    case "title":
      doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(safeText(block.text), { width });
      return;
    case "subtitle":
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(safeText(block.text), { width });
      return;
    case "heading":
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(safeText(block.text), { width });
      doc.moveDown(0.3);
      return;
    case "paragraph":
      doc.font("Helvetica").fontSize(9.5).fillColor(INK)
        .text(safeText(block.text), { width, align: "left", lineGap: 2 });
      doc.moveDown(0.5);
      return;
    case "note":
      noteBlock(doc, block.text, width);
      return;
    case "divider":
      rule(doc, width);
      return;
    case "metrics":
      doc.moveDown(0.2);
      drawMetrics(doc, block.items, width);
      doc.moveDown(0.6);
      return;
    case "list":
      drawList(doc, block);
      return;
    case "table": {
      if (block.caption) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
          .text(safeText(block.caption).toUpperCase(), { characterSpacing: 0.6 });
        doc.moveDown(0.2);
      }
      drawTable(doc, block.columns, block.rows, width);
      doc.moveDown(0.7);
      return;
    }
  }
}

function noteBlock(doc: PDFKit.PDFDocument, text: string, width: number): void {
  doc.moveDown(0.2);
  const startY = doc.y;
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(MUTED)
    .text(safeText(text), { width: width - 12, lineGap: 1.5 });
  const endY = doc.y;
  // A left rule rather than a filled box, so the page stays document-like.
  doc.save().strokeColor(RULE).lineWidth(1.5)
    .moveTo(PAGE_MARGIN, startY).lineTo(PAGE_MARGIN, endY).stroke().restore();
  doc.moveDown(0.5);
}

function drawMetrics(doc: PDFKit.PDFDocument, items: Metric[], width: number): void {
  if (items.length === 0) return;
  const columns = Math.min(items.length, 3);
  const cellWidth = (width - 12 * (columns - 1)) / columns;
  const labelSize = 7.5;
  const valueSize = cellWidth < 190 ? 13 : 16;
  // Measure the value height with the real font set on the document, because
  // heightOfString reads the current font rather than accepting one. The font
  // is set again for each cell below, so there is nothing to restore.
  doc.font("Helvetica-Bold").fontSize(valueSize);
  const rowHeight = 16 + doc.heightOfString("Xg", { width: cellWidth }) + 10;

  items.forEach((item, index) => {
    const column = index % columns;
    if (column === 0 && index > 0) doc.moveDown(rowHeight + 8);
    if (column === 0) ensureSpace(doc, rowHeight + 10);
    const x = PAGE_MARGIN + column * (cellWidth + 12);

    doc.font("Helvetica-Bold").fontSize(labelSize).fillColor(MUTED)
      .text(safeText(item.label).toUpperCase(), x, doc.y, { width: cellWidth, characterSpacing: 0.7 });
    doc.moveDown(0.25);
    doc.font("Helvetica-Bold").fontSize(valueSize).fillColor(INK)
      .text(safeText(item.value), x, doc.y, { width: cellWidth, lineGap: 1 });
    if (item.note) {
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
        .text(safeText(item.note), x, doc.y, { width: cellWidth });
    }
  });
  doc.moveDown(0.4);
  resetX(doc);
}

function drawList(doc: PDFKit.PDFDocument, block: Extract<Block, { kind: "list" }>): void {
  if (block.items.length === 0) return;
  block.items.forEach((item, index) => {
    const marker = block.ordered ? `${index + 1}.` : "-";
    ensureSpace(doc, 20);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
      .text(safeText(marker), PAGE_MARGIN, y, { width: 18, lineBreak: false });
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
      .text(safeText(item), PAGE_MARGIN + 18, y, {
        width: doc.page.width - PAGE_MARGIN * 2 - 18,
        lineGap: 1.5,
      });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.4);
  resetX(doc);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: string[],
  rows: string[][],
  width: number,
): void {
  // Column widths proportional to a per-column weight derived from the longest
  // cell, so a wide "Finding" column does not squeeze a short "Date" column.
  const weights = columns.map((_, columnIndex) => {
    const longest = rows.reduce((max, row) => {
      const cell = row[columnIndex] ?? "";
      return Math.max(max, Math.min(cell.length, 46));
    }, columns[columnIndex].length);
    return Math.max(8, longest);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const widths = weights.map((weight) => (weight / totalWeight) * width);

  const left = PAGE_MARGIN;
  const right = left + width;

  // Header
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
  let x = left;
  columns.forEach((column, index) => {
    doc.text(safeText(column).toUpperCase(), x, y, {
      width: widths[index] - 6,
      characterSpacing: 0.5,
      lineBreak: false,
      ellipsis: true,
    });
    x += widths[index];
  });
  y = doc.y + 3;
  doc.save().strokeColor(INK).lineWidth(1.2).moveTo(left, y).lineTo(right, y).stroke().restore();
  doc.y = y + 5;

  // Body
  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell) => safeText(cell ?? ""));
    const heights = cells.map((cell, index) =>
      doc.font("Helvetica").fontSize(8.5).heightOfString(cell, { width: widths[index] - 6 }),
    );
    const rowHeight = Math.max(...heights, 10);

    if (doc.y + rowHeight > doc.page.height - PAGE_MARGIN - 20) {
      doc.addPage();
      y = doc.y;
    }

    const rowTop = doc.y;
    if (rowIndex % 2 === 1) {
      doc.save().fillColor("#f6f4ec")
        .rect(left, rowTop, width, rowHeight + 4).fill().restore();
    }

    let cellX = left;
    cells.forEach((cell, index) => {
      doc.font("Helvetica").fontSize(8.5).fillColor(INK)
        .text(cell, cellX, rowTop, { width: widths[index] - 6, lineGap: 1 });
      cellX += widths[index];
    });

    doc.y = rowTop + rowHeight + 4;
    const separatorY = doc.y;
    doc.save().strokeColor(RULE).lineWidth(0.5)
      .moveTo(left, separatorY).lineTo(right, separatorY).stroke().restore();
    doc.y = separatorY + 4;
  });

  doc.moveDown(0.2);
  resetX(doc);
}
