// Generates the editable QA13-CF01 "Goods In & Out Form" as a .docx, pre-filled
// with the PO + compliance details. The remaining checklist is left blank for
// compliance to complete and send to the warehouse. Runs server-side.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
} from "docx";
import type { GoodsInRecord } from "./goods-in";

const INK = "393836";
const MUTE = "8A8480";
const LINE = "D9D2C7";

function labelValue(label: string, value: string): TableCell {
  return new TableCell({
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: label + "  ", bold: true, size: 20, color: INK }),
          new TextRun({ text: value || "", size: 20, color: value ? INK : MUTE }),
        ],
      }),
    ],
  });
}

function twoCol(rows: [string, string, string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders(),
    rows: rows.map(([l1, v1, l2, v2]) => new TableRow({
      children: [labelValue(l1, v1), labelValue(l2, v2)],
    })),
  });
}

function allBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function headCell(text: string, w?: number): TableCell {
  return new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: "F2EEE8" },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, color: INK })] })],
  });
}
function cell(text = "", opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number; color?: string } = {}): TableCell {
  return new TableCell({
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, size: opts.size ?? 18, color: opts.color ?? INK })] })],
  });
}

// A "Confirm / Deny / Example / Action" style checklist table.
function checklist(title: string, cols: string[], rows: (string | null)[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders(),
    rows: [
      new TableRow({ children: [headCell(title, 34), ...cols.map(c => headCell(c))] }),
      ...rows.map(r => new TableRow({
        children: r.map((val, i) => i === 0 ? cell(val ?? "") : cell(val ?? "", { align: AlignmentType.CENTER })),
      })),
    ],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: INK })],
  });
}
function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

export async function buildGoodsInDoc(r: GoodsInRecord): Promise<Buffer> {
  const yn = (v: string, target: string) => (v.toLowerCase() === target.toLowerCase() ? `[X] ${target}` : `[  ] ${target}`);

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Goods In & Out Form", bold: true, size: 32, color: INK })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [new TextRun({ text: "QA13-CF01 V4", size: 16, color: MUTE })],
        }),

        twoCol([
          ["Date:", r.date, "Time:", r.time],
          ["PO Number:", r.po, "Haulier:", r.haulier],
        ]),
        spacer(),

        heading("Delivery details"),
        twoCol([
          ["Part Number:", r.partNumber, "Batch/Lot No.:", r.batchLot],
          ["Description:", r.description, "BBD:", r.bbd],
          ["Quantity:", r.quantity, "Supplier:", r.supplier],
          ["Supplier Product Code:", r.supplierProductCode, "Received:", ""],
        ]),
        spacer(),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: allBorders(),
          rows: [
            new TableRow({ children: [
              cell("CofA/CoC received? (Inbound only)"),
              cell(yn(r.cofaReceived, "Yes"), { align: AlignmentType.CENTER }),
              cell(yn(r.cofaReceived, "No"), { align: AlignmentType.CENTER }),
              cell("Sign. VP / JB:"),
            ] }),
            new TableRow({ children: [
              cell("Do the details of goods and the delivery note match? (Inbound only)"),
              cell("[  ] Yes", { align: AlignmentType.CENTER }),
              cell("[  ] No", { align: AlignmentType.CENTER }),
              cell("Sign:"),
            ] }),
          ],
        }),
        spacer(),

        checklist("Vehicle Condition (Haulier)", ["Confirm", "Deny", "Example", "Action"], [
          ["Free from pest activity", "", "", "Droppings, Footprints"],
          ["Free from foreign bodies", "", "", "Metal, Wood, Glass"],
          ["Free from spillages or leaks", "", "", "Odours, Spillages, Leakages"],
        ]),
        new Paragraph({ spacing: { before: 40, after: 120 }, children: [new TextRun({ text: "If 'Deny' is ticked, hold the driver/vehicle and inform Compliance/Operations/Supply Chain Manager.", italics: true, size: 16, color: MUTE })] }),

        checklist("Product & Pallet Condition", ["Confirm", "Deny", "Example", "Action"], [
          ["Pallet is in good condition", "", "", "Damage, Cleanliness"],
          ["Product is in good condition", "", "", "Damage, Exposed Material"],
        ]),
        spacer(),

        checklist("Certification (If Applicable)", ["Confirm", "Deny", "Example", "Action"], [
          ["MSC", "", "", "If not labelled, do not book in and inform Compliance."],
          ["Soil Association (Organic)", "", "", ""],
        ]),
        spacer(),

        checklist("Finished Goods Only — QC Check", ["Confirm", "Deny", "", ""], [
          ["Correct Product", "", "", ""],
          ["Batch, BBD & FG Quantity", "", "", ""],
          ["10 Samples in QC", "", "", ""],
        ]),
        spacer(),

        heading("Comments / Deviations"),
        new Paragraph({ children: [new TextRun({ text: r.comments || "", size: 20, color: r.comments ? INK : MUTE })] }),
        ...(r.coaUrl || r.docUrls.length ? [
          new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Attached documents:", bold: true, size: 18, color: INK })] }),
          ...(r.coaUrl ? [new Paragraph({ children: [new TextRun({ text: "• CofA: " + r.coaUrl, size: 16, color: MUTE })] })] : []),
          ...r.docUrls.map(u => new Paragraph({ children: [new TextRun({ text: "• " + u, size: 16, color: MUTE })] })),
        ] : []),
        spacer(),
        spacer(),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: allBorders(),
          rows: [new TableRow({ children: [
            cell("SIGN:  ______________________"),
            cell("COMPLIANCE SIGN:  ______________________"),
          ] })],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// Safe filename for the generated document.
export function docFilename(r: GoodsInRecord): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `GoodsIn-${safe(r.po) || "PO"}-${safe(r.partNumber)}.docx`;
}
