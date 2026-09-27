/**
 * Word (.docx) rendering for the screening report.
 *
 * Consumes the same `ReportSection` list as the page and the PDF, so the Word
 * file is the same document. Styling is deliberately plain: black on white,
 * a single accent, ruled tables.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportSection } from "@/lib/report/sections";
import type { Block } from "@/lib/report/document";

const INK = "0A0A0A";
const MUTED = "5C5C5C";
const RULE = "C9C2AE";
const TINT = "F6F4EC";
const ACCENT = "FF3B3B";

const CONTENT_WIDTH = 9638; // twips, A4 portrait minus 1 inch margins

export async function renderReportDocx(
  sections: ReportSection[],
  meta: { title: string; subtitle: string; footer: string },
): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  // ---- Cover heading ------------------------------------------------------
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "JALDRISHTI",
          bold: true,
          size: 18,
          color: ACCENT,
          characterSpacing: 40,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: meta.title, bold: true, size: 32, color: INK })],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 6 } },
      children: [new TextRun({ text: meta.subtitle, size: 18, color: MUTED })],
    }),
  );

  // ---- Sections -----------------------------------------------------------
  sections.forEach((section, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 4 } },
        children: [
          new TextRun({
            text: `${index + 1}. ${section.title}`,
            bold: true,
            size: 22,
            color: INK,
          }),
        ],
      }),
    );

    for (const block of section.blocks) {
      children.push(...renderBlock(block));
    }
  });

  // No trailing footer paragraph here: the page footer below already prints
  // this line, and a second copy at the end of the body was enough to overflow
  // onto an extra sheet, which Word then rendered blank.

  const document = new Document({
    creator: "JalDrishti",
    title: meta.title,
    description: "Preliminary water feasibility screening",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 19, color: INK } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: meta.footer,
                    size: 13,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

function renderBlock(block: Block): Array<Paragraph | Table> {
  switch (block.kind) {
    case "title":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: 30, color: INK })],
        }),
      ];

    case "subtitle":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, size: 18, color: MUTED })],
        }),
      ];

    case "heading":
      return [
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: block.text, bold: true, size: 22, color: INK })],
        }),
      ];

    case "paragraph":
      return [
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: block.text, size: 19, color: INK })],
        }),
      ];

    case "note": {
      const out: Array<Paragraph | Table> = [
        new Paragraph({
          spacing: { before: 80, after: 160 },
          indent: { left: 200 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: RULE, space: 10 } },
          children: [
            new TextRun({ text: block.text, size: 16, color: MUTED, italics: true }),
          ],
        }),
      ];
      return out;
    }

    case "divider":
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
          children: [],
        }),
      ];

    case "metrics": {
      if (block.items.length === 0) return [];
      const cells = block.items.map((item) =>
        new TableCell({
          width: { size: Math.floor(CONTENT_WIDTH / block.items.length), type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: item.label.toUpperCase(),
                  bold: true,
                  size: 14,
                  color: MUTED,
                  characterSpacing: 20,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: item.note ? 40 : 0 },
              children: [new TextRun({ text: item.value, bold: true, size: 26, color: INK })],
            }),
            ...(item.note
              ? [
                  new Paragraph({
                    children: [new TextRun({ text: item.note, size: 16, color: MUTED })],
                  }),
                ]
              : []),
          ],
        }),
      );
      return [
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: block.items.map(() => Math.floor(CONTENT_WIDTH / block.items.length)),
          borders: noBorders(),
          rows: [new TableRow({ children: cells })],
        }),
        spacer(),
      ];
    }

    case "list": {
      if (block.items.length === 0) return [];
      return block.items.map(
        (item, index) =>
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360, hanging: 260 },
            children: [
              new TextRun({
                text: block.ordered ? `${index + 1}. ` : "-  ",
                bold: block.ordered,
                size: 19,
                color: INK,
              }),
              new TextRun({ text: item, size: 19, color: INK }),
            ],
          }),
      );
    }

    case "table": {
      // An empty table is one the section builder chose to omit, so it is
      // skipped rather than rendered as an empty grid.
      if (block.rows.length === 0) return [];
      const out: Array<Paragraph | Table> = [];
      if (block.caption) {
        out.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: block.caption.toUpperCase(),
                bold: true,
                size: 14,
                color: MUTED,
                characterSpacing: 20,
              }),
            ],
          }),
        );
      }
      out.push(buildTable(block.columns, block.rows));
      out.push(spacer());
      return out;
    }

    default:
      return [];
  }
}

/**
 * The empty paragraph that separates two blocks.
 *
 * A body cannot end on a table, so one of these is always needed. It is kept to
 * a 2pt run with no spacing so the gaps between blocks stay tight and the last
 * block is not pushed onto a fresh, empty sheet.
 */
function spacer(): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: "", size: 2 })],
  });
}

function buildTable(columns: string[], rows: string[][]): Table {
  const columnCount = Math.max(columns.length, ...rows.map((row) => row.length), 1);
  const columnWidth = Math.floor(CONTENT_WIDTH / columnCount);

  const headerRow = new TableRow({
    tableHeader: true,
    children: Array.from({ length: columnCount }, (_, index) =>
      new TableCell({
        width: { size: columnWidth, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        borders: {
          bottom: { style: BorderStyle.SINGLE, size: 10, color: INK },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: (columns[index] ?? "").toUpperCase(),
                bold: true,
                size: 14,
                color: MUTED,
                characterSpacing: 16,
              }),
            ],
          }),
        ],
      }),
    ),
  });

  const bodyRows = rows.map(
    (row, rowIndex) =>
      new TableRow({
        children: Array.from({ length: columnCount }, (_, index) =>
          new TableCell({
            width: { size: columnWidth, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            shading:
              rowIndex % 2 === 1
                ? { type: ShadingType.CLEAR, fill: TINT, color: "auto" }
                : undefined,
            borders: {
              bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text: row[index] ?? "", size: 17, color: INK })],
              }),
            ],
          }),
        ),
      }),
  );

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: Array.from({ length: columnCount }, () => columnWidth),
    rows: [headerRow, ...bodyRows],
  });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  };
}
