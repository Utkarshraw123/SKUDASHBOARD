// Generates the QA13-CF01 "Goods In & Out Form" as an editable .docx — a faithful,
// complete reproduction of the source template. Only the identity fields (from the
// PO) and the three compliance fields (Supplier Product Code, Batch/Lot No., BBD)
// are pre-filled; every check, signature, date/time and comment is left blank for
// the warehouse to complete by hand. Runs server-side.
//
// Column widths are fixed (DXA/twips) with a fixed table layout so the form renders
// identically across Word, LibreOffice and previewers (percentage widths collapse).

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, VerticalAlign, TableLayoutType,
} from "docx";
import type { GoodsInRecord } from "./goods-in";

const INK = "1E1E1E";
const MUTE = "8A8480";
const LINE = "B4AB9C";
const HEAD_FILL = "EFEAE2";

// A4 (11906 twips) minus 620-twip margins each side.
const CW = 10666;
const pct = (p: number) => Math.round((CW * p) / 100);

const B = { style: BorderStyle.SINGLE, size: 6, color: LINE };
const TB = { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B };

function run(text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size ?? 18, color: o.color ?? INK });
}
function para(children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: { before?: number; after?: number } } = {}) {
  return new Paragraph({ alignment: o.align, spacing: o.spacing, children });
}
function table(colDxa: number[], rows: TableRow[]): Table {
  return new Table({ columnWidths: colDxa, layout: TableLayoutType.FIXED, width: { size: colDxa.reduce((a, b) => a + b, 0), type: WidthType.DXA }, borders: TB, rows });
}

// A label:value cell (label bold, value beside it, or blank when unfilled).
function fieldCell(w: number, label: string, value: string): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [para([run(label + "  ", { bold: true }), run(value || "")])],
  });
}
function cell(w: number, text: string, o: { head?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: o.head ? { fill: HEAD_FILL } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [para([run(text, { bold: o.bold ?? o.head, italics: o.italics, size: o.size ?? 18, color: o.color })], { align: o.align })],
  });
}
function bar(text: string, o: { head?: boolean; bold?: boolean; italics?: boolean; size?: number } = {}): Table {
  return table([CW], [new TableRow({ children: [cell(CW, text, o)] })]);
}

// "<section> | Confirm | Deny | Example | Action" checklist.
function checklist(section: string, rows: { item: string; example: string; action?: string }[]): Table {
  const w = [pct(34), pct(11), pct(11), pct(20), pct(24)];
  return table(w, [
    new TableRow({ children: [
      cell(w[0], section, { head: true }),
      cell(w[1], "Confirm", { head: true, align: AlignmentType.CENTER }),
      cell(w[2], "Deny", { head: true, align: AlignmentType.CENTER }),
      cell(w[3], "Example", { head: true }),
      cell(w[4], "Action", { head: true }),
    ] }),
    ...rows.map(r => new TableRow({ children: [
      cell(w[0], r.item),
      cell(w[1], ""),
      cell(w[2], ""),
      cell(w[3], r.example, { color: MUTE, size: 16 }),
      cell(w[4], r.action ?? "", { color: MUTE, size: 15, italics: true }),
    ] })),
  ]);
}

const gap = () => new Paragraph({ spacing: { after: 90 }, children: [] });
const emptyLines = (n: number) => Array.from({ length: n }, () => new Paragraph({ spacing: { after: 60 }, children: [run(" ")] }));

export async function buildGoodsInDoc(r: GoodsInRecord): Promise<Buffer> {
  const half = [pct(50), pct(50)];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 620, bottom: 620, left: 620, right: 620 } } },
      children: [
        // Header: title (left) + Date / Time / PO Number (right)
        table([pct(64), pct(36)], [new TableRow({ children: [
          new TableCell({
            width: { size: pct(64), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [para([run("Goods In & Out Form", { bold: true, size: 34 })]), para([run("QA13-CF01 V4", { size: 15, color: MUTE })])],
          }),
          new TableCell({
            width: { size: pct(36), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 90, bottom: 90, left: 150, right: 150 },
            children: [
              para([run("Date: ", { bold: true }), run("")], { spacing: { after: 90 } }),
              para([run("Time: ", { bold: true }), run("")], { spacing: { after: 90 } }),
              para([run("PO Number: ", { bold: true }), run(r.po)]),
            ],
          }),
        ] })]),
        gap(),

        // Core delivery details — identity (auto) + the 3 compliance fields
        table(half, [
          new TableRow({ children: [fieldCell(half[0], "Part Number:", r.partNumber), fieldCell(half[1], "Batch/Lot No.:", r.batchLot)] }),
          new TableRow({ children: [fieldCell(half[0], "Description:", r.description), fieldCell(half[1], "BBD:", r.bbd)] }),
          new TableRow({ children: [fieldCell(half[0], "Quantity:", r.quantity), fieldCell(half[1], "Supplier:", r.supplier)] }),
          new TableRow({ children: [fieldCell(half[0], "Supplier Product Code:", r.supplierProductCode), fieldCell(half[1], "Haulier:", "")] }),
        ]),
        gap(),

        // Inbound checks
        table([pct(58), pct(8), pct(8), pct(26)], [
          new TableRow({ children: [
            cell(pct(58), "CofA/CoC received? (Inbound only)"),
            cell(pct(8), "YES", { head: true, align: AlignmentType.CENTER }),
            cell(pct(8), "NO", { head: true, align: AlignmentType.CENTER }),
            cell(pct(26), "Sign. VP / JB:"),
          ] }),
          new TableRow({ children: [
            cell(pct(58), "Do the details of goods and the delivery note match? (Inbound only)"),
            cell(pct(8), "YES", { head: true, align: AlignmentType.CENTER }),
            cell(pct(8), "NO", { head: true, align: AlignmentType.CENTER }),
            cell(pct(26), "Sign:"),
          ] }),
        ]),
        gap(),

        checklist("Vehicle Condition (Haulier)", [
          { item: "Free from pest activity", example: "Droppings, Footprints", action: "If 'Deny' is ticked, hold the driver/vehicle and inform Compliance/Operations/Supply Chain Manager. The decision/inspection will be made on whether to proceed with the unloading/loading of goods." },
          { item: "Free from foreign bodies", example: "Metal, Wood, Glass" },
          { item: "Free from spillages or leaks", example: "Odours, Spillages, Leakages" },
        ]),
        gap(),

        checklist("Product & Pallet Condition", [
          { item: "Pallet is in good condition", example: "Damage, Cleanliness", action: "If 'Deny' is ticked, place the pallet on hold and inform Compliance/Operations/Supply Chain Manager." },
          { item: "Product is in good condition", example: "Damage, Exposed Material" },
        ]),
        gap(),

        bar("Please refer to Product List to determine whether the certification is applicable", { italics: true, size: 16 }),
        checklist("Certification (If Applicable)", [
          { item: "MSC", example: "", action: "If not labelled, do not book in and inform Compliance/Operations/Supply Chain Manager." },
          { item: "Soil Association (Organic)", example: "" },
        ]),
        gap(),

        bar("FINISHED GOODS ONLY", { head: true, bold: true }),
        bar("Once goods are booked in and checked, collect one shipper from the pallet then conduct the following and confirm:", { italics: true, size: 16 }),
        table([pct(70), pct(15), pct(15)], [
          new TableRow({ children: [cell(pct(70), "QC Check", { head: true }), cell(pct(15), "Confirm", { head: true, align: AlignmentType.CENTER }), cell(pct(15), "Deny", { head: true, align: AlignmentType.CENTER })] }),
          ...["Correct Product", "Batch, BBD & FG Quantity", "10 Samples in QC"].map(t =>
            new TableRow({ children: [cell(pct(70), t), cell(pct(15), ""), cell(pct(15), "")] })),
        ]),
        gap(),

        bar("Comments / Deviations", { head: true, bold: true }),
        table([CW], [new TableRow({ children: [new TableCell({ width: { size: CW, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, children: emptyLines(6) })] })]),
        gap(),

        table([pct(30), pct(70)], [
          new TableRow({ children: [cell(pct(30), "SIGN", { bold: true }), cell(pct(70), "")] }),
          new TableRow({ children: [cell(pct(30), "COMPLIANCE SIGN", { bold: true }), cell(pct(70), "")] }),
        ]),
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

// Combined multi-line QA13-CF01 for a whole PO — same checklist/sign sections as
// buildGoodsInDoc, but with a single products table instead of one core-fields block.
export interface GoodsInPoLine {
  partNumber: string;
  description: string;
  quantity: string;
  supplierProductCode: string;
  batchLot: string;
  bbd: string;
}

export async function buildGoodsInPoDoc(input: { po: string; supplier: string; lines: GoodsInPoLine[] }): Promise<Buffer> {
  const H = (t: string, w: number, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) => cell(w, t, { head: true, align });
  const COLS = [1750, 3216, 900, 1800, 1600, 1400]; // = CW (10666): Part, Description, Qty, Supplier Code, Batch/Lot, BBD
  const productsTable = table(COLS, [
    new TableRow({ children: [
      H("Part", COLS[0]), H("Description", COLS[1]), H("Qty", COLS[2], AlignmentType.RIGHT),
      H("Supplier Product Code", COLS[3]), H("Batch/Lot No.", COLS[4]), H("BBD", COLS[5]),
    ] }),
    ...input.lines.map(l => new TableRow({ children: [
      cell(COLS[0], l.partNumber), cell(COLS[1], l.description),
      cell(COLS[2], l.quantity, { align: AlignmentType.RIGHT }),
      cell(COLS[3], l.supplierProductCode), cell(COLS[4], l.batchLot), cell(COLS[5], l.bbd),
    ] })),
  ]);

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 620, bottom: 620, left: 620, right: 620 } } },
      children: [
        // Header: title (left) + Date / Time / PO Number (right)
        table([pct(64), pct(36)], [new TableRow({ children: [
          new TableCell({
            width: { size: pct(64), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [para([run("Goods In & Out Form", { bold: true, size: 34 })]), para([run("QA13-CF01 V4", { size: 15, color: MUTE })])],
          }),
          new TableCell({
            width: { size: pct(36), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 90, bottom: 90, left: 150, right: 150 },
            children: [
              para([run("Date: ", { bold: true }), run("")], { spacing: { after: 90 } }),
              para([run("Time: ", { bold: true }), run("")], { spacing: { after: 90 } }),
              para([run("PO Number: ", { bold: true }), run(input.po)]),
            ],
          }),
        ] })]),
        gap(),

        // Supplier line + products table (multi-line, replaces the single core-fields block)
        table([pct(50), pct(50)], [
          new TableRow({ children: [fieldCell(pct(50), "PO Number:", input.po), fieldCell(pct(50), "Supplier:", input.supplier)] }),
        ]),
        gap(),
        bar("Products received"),
        productsTable,
        gap(),

        // Inbound checks
        table([pct(58), pct(8), pct(8), pct(26)], [
          new TableRow({ children: [
            cell(pct(58), "CofA/CoC received? (Inbound only)"),
            cell(pct(8), "YES", { head: true, align: AlignmentType.CENTER }),
            cell(pct(8), "NO", { head: true, align: AlignmentType.CENTER }),
            cell(pct(26), "Sign. VP / JB:"),
          ] }),
          new TableRow({ children: [
            cell(pct(58), "Do the details of goods and the delivery note match? (Inbound only)"),
            cell(pct(8), "YES", { head: true, align: AlignmentType.CENTER }),
            cell(pct(8), "NO", { head: true, align: AlignmentType.CENTER }),
            cell(pct(26), "Sign:"),
          ] }),
        ]),
        gap(),

        checklist("Vehicle Condition (Haulier)", [
          { item: "Free from pest activity", example: "Droppings, Footprints", action: "If 'Deny' is ticked, hold the driver/vehicle and inform Compliance/Operations/Supply Chain Manager. The decision/inspection will be made on whether to proceed with the unloading/loading of goods." },
          { item: "Free from foreign bodies", example: "Metal, Wood, Glass" },
          { item: "Free from spillages or leaks", example: "Odours, Spillages, Leakages" },
        ]),
        gap(),

        checklist("Product & Pallet Condition", [
          { item: "Pallet is in good condition", example: "Damage, Cleanliness", action: "If 'Deny' is ticked, place the pallet on hold and inform Compliance/Operations/Supply Chain Manager." },
          { item: "Product is in good condition", example: "Damage, Exposed Material" },
        ]),
        gap(),

        bar("Please refer to Product List to determine whether the certification is applicable", { italics: true, size: 16 }),
        checklist("Certification (If Applicable)", [
          { item: "MSC", example: "", action: "If not labelled, do not book in and inform Compliance/Operations/Supply Chain Manager." },
          { item: "Soil Association (Organic)", example: "" },
        ]),
        gap(),

        bar("FINISHED GOODS ONLY", { head: true, bold: true }),
        bar("Once goods are booked in and checked, collect one shipper from the pallet then conduct the following and confirm:", { italics: true, size: 16 }),
        table([pct(70), pct(15), pct(15)], [
          new TableRow({ children: [cell(pct(70), "QC Check", { head: true }), cell(pct(15), "Confirm", { head: true, align: AlignmentType.CENTER }), cell(pct(15), "Deny", { head: true, align: AlignmentType.CENTER })] }),
          ...["Correct Product", "Batch, BBD & FG Quantity", "10 Samples in QC"].map(t =>
            new TableRow({ children: [cell(pct(70), t), cell(pct(15), ""), cell(pct(15), "")] })),
        ]),
        gap(),

        bar("Comments / Deviations", { head: true, bold: true }),
        table([CW], [new TableRow({ children: [new TableCell({ width: { size: CW, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, children: emptyLines(6) })] })]),
        gap(),

        table([pct(30), pct(70)], [
          new TableRow({ children: [cell(pct(30), "SIGN", { bold: true }), cell(pct(70), "")] }),
          new TableRow({ children: [cell(pct(30), "COMPLIANCE SIGN", { bold: true }), cell(pct(70), "")] }),
        ]),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// Safe filename for the generated combined document.
export function poDocFilename(po: string): string {
  const safe = (s: string) => (s || "").replace(/[^A-Za-z0-9._-]+/g, "-");
  return `GoodsIn-${safe(po) || "PO"}-all.docx`;
}
