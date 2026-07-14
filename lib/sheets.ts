import { google } from "googleapis";
import { cache } from "react";
import type { SkuRow, ProductionRow, PlanningRow, BulkPoRow, PackingRow, BomSheet } from "./types";

function cleanNum(s: string): number | null {
  if (!s || s.trim() === "" || s === "#N/A" || s === "Not Planned") return null;
  const cleaned = s.replace(/,/g, "").replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function cleanPct(s: string): number | null {
  if (!s || !s.includes("%")) return null;
  const n = parseFloat(s.replace("%", ""));
  return isNaN(n) ? null : n;
}

async function getSheets() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var missing");

  const creds = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    // read+write: existing fetchers only read; production-report append needs write
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export const fetchSkus = cache(async (): Promise<SkuRow[]> => {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var missing");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "ALL SKU DASHBOARD!A1:AX200",
  });

  const rows = res.data.values ?? [];
  // Skip first 2 header rows
  const dataRows = rows.slice(2);

  return dataRows
    .filter((r) => r[2] && r[2].trim() !== "") // must have SKU code
    .map((r): SkuRow => ({
      rowNum: r[0] ?? "",
      bulk: r[1] ?? "",
      skuCode: r[2] ?? "",
      description: r[3] ?? "",
      type: r[4] ?? "",
      cover: cleanNum(r[5]),
      potentialBulkToUnits: cleanNum(r[6]),
      inventory: cleanNum(r[7]),
      wnpStock: cleanNum(r[8]),
      coverAtWNP: cleanNum(r[9]),
      externalStock: cleanNum(r[10]),
      fill: cleanNum(r[11]),
      monthlyDemandAvg: cleanNum(r[13]),
      monthlyDemandLastQtr: cleanNum(r[14]),
      salesVariance: cleanPct(r[15]),
      potentialFGWNC: cleanNum(r[17]),
      bulkAtWNC: r[18] ?? "",
      totalPotentialUnits: cleanNum(r[19]),
      totalWeeksCover: cleanNum(r[20]),
      weeksOver: cleanNum(r[21]),
      potentialUnitsOther: cleanNum(r[23]),
      weeksOverOther: cleanNum(r[24]),
      bulkAtOther: r[25] ?? "",
      nextBulkDelivery: r[27] ?? "",
      bulkDeliveryQty: cleanNum(r[28]),
      bulkPotentialUnits: cleanNum(r[29]),
      bulkETA: r[30] ?? "",
      bulkPlannedQty: r[31] ?? "",
      packerVendor: r[32] ?? "",
      totalPlannedTs: cleanNum(r[33]),
      nextPackingDelivery: r[35] ?? "",
      packingDeliveryQty: cleanNum(r[36]),
      packingETA: r[37] ?? "",
      packingSplitSKUs: r[38] ?? "",
      packingVendor: r[39] ?? "",
      totalPackingPlanned: cleanNum(r[40]),
      unitsToBePlanned: cleanNum(r[42]),
      unitsNotPlanned: cleanNum(r[43]),
      projectedCover: cleanNum(r[44]),
      demand12Week: cleanNum(r[46]),
      demand3Month: cleanNum(r[47]),
      demand16WeekCover: cleanNum(r[48]),
    }));
});

function parseDate(s: string): Date | null {
  if (!s || s.trim() === "") return null;
  const parts = s.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  return null;
}

function urgency(dueDateStr: string): PackingRow["urgency"] {
  const due = parseDate(dueDateStr);
  if (!due) return "upcoming";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "this_week";
  return "upcoming";
}

export const fetchProduction = cache(async (): Promise<ProductionRow[]> => {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var missing");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "New Production Master!A1:W430",
  });

  const rows = res.data.values ?? [];
  return rows
    .slice(3)
    .filter((r) => r[3] && r[3].trim() !== "")
    .map((r): ProductionRow => {
      const qty = cleanNum(r[9]);
      const received = cleanNum(r[10]);
      let status: ProductionRow["status"] = "open";
      if (received !== null && qty !== null && received >= qty) status = "complete";
      else if (received !== null && received > 0) status = "partial";
      return {
        vendor: r[0] ?? "",
        vendorName: r[1] ?? "",
        orderType: (r[2] ?? "").trim(),
        order: r[3] ?? "",
        raisedDate: r[4] ?? "",
        productionDate: r[5] ?? "",
        dueDate: r[6] ?? "",
        partNumber: r[7] ?? "",
        description: r[8] ?? "",
        quantity: qty,
        received,
        unit: r[11] ?? "",
        cost: r[12] ?? "",
        costPerUnit: (() => { const n = parseFloat((r[12] ?? "").replace(/[£,\s]/g, "")); return isNaN(n) ? null : n; })(),
        workOrder: r[14] ?? "",
        poStatus: r[15] ?? "",
        kitStatus: r[16] ?? "",
        completionDate: r[20] ?? "",
        status,
      };
    });
});

export const fetchWNPPlanning = cache(async (): Promise<PlanningRow[]> => {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var missing");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "WNP PLANNING!A1:V1048",
  });

  const rows = res.data.values ?? [];
  return rows
    .slice(3)
    .filter((r) => r[7] && r[7].trim() !== "")
    .map((r): PlanningRow => {
      const qty = cleanNum(r[6]);
      const produced = cleanNum(r[8]);
      const statusText = (r[21] ?? "").toUpperCase().trim();
      let status: PlanningRow["status"] = "planned";
      if (statusText === "COMPLETED") status = "complete";
      else if (produced !== null && produced > 0) status = "in_progress";
      // format batch number: col 14 is sometimes an Excel serial date
      const batchRaw = r[14] ?? "";
      const batch = batchRaw && !isNaN(Number(batchRaw)) && Number(batchRaw) > 40000
        ? new Date(Math.round((Number(batchRaw) - 25569) * 86400 * 1000)).toLocaleDateString("en-GB")
        : batchRaw;
      return {
        plannedWeek: r[0] ?? "",
        plannedDays: r[1] ?? "",
        bulkCode: r[2] ?? "",
        productCode: r[3] ?? "",
        description: r[4] ?? "",
        fill: cleanNum(r[5]),
        quantity: qty,
        workOrderNo: r[7] ?? "",
        quantityProduced: produced,
        bulkAtWNP: r[9] ?? "",
        notes: r[10] ?? "",
        currentStock: cleanNum(r[11]),
        batch,
        bbd: r[15] ?? "",
        dateCompleted: r[16] ?? "",
        statusText: r[21] ?? "",
        status,
      };
    });
});

export const fetchBulkOpenPOs = cache(async (): Promise<BulkPoRow[]> => {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var missing");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Open Purchase Orders!A1:L240",
  });

  const rows = res.data.values ?? [];
  return rows
    .slice(1)
    .filter((r) => r[3] && r[3].trim() !== "") // must have PO
    .map((r): BulkPoRow => ({
      vendorNumber: r[0] ?? "",
      vendorName: r[1] ?? "",
      order: r[3] ?? "",
      date: r[4] ?? "",
      partNumber: r[5] ?? "",
      description: r[6] ?? "",
      partType: r[7] ?? "",
      dueDate: r[10] ?? "",
      orderQuantity: cleanNum(r[11]),
    }));
});

export const fetchPackingSchedule = cache(async (): Promise<PackingRow[]> => {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var missing");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Packing Schedule!A1:H470",
  });

  const rows = res.data.values ?? [];
  return rows
    .slice(1)
    .filter((r) => r[0] && r[0].trim() !== "") // must have part number
    .map((r): PackingRow => ({
      partNumber: r[0] ?? "",
      description: r[1] ?? "",
      dueDate: r[2] ?? "",
      purchaseOrder: r[3] ?? "",
      balance: cleanNum(r[4]),
      vendorNumber: r[5] ?? "",
      vendorName: r[6] ?? "",
      urgency: urgency(r[2] ?? ""),
    }));
});

const BOM_SHEET_ID = "19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w";
const STOCK_SHEET_ID = "1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0";

export interface InventoryRow {
  warehouse: string;
  warehouseDesc: string;
  partNumber: string;
  description: string;
  balance: number;
  unit: string;
}

export const fetchCurrentInventory = cache(async (): Promise<InventoryRow[]> => {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: STOCK_SHEET_ID,
    range: "Current Inventory!A1:F5000",
  });
  const rows = (res.data.values ?? []) as string[][];
  // Find the header row (contains "Part Number"), data follows
  const headerIdx = rows.findIndex(r => (r[2] ?? "").trim() === "Part Number");
  return rows
    .slice(headerIdx + 1)
    .filter(r => r[2] && String(r[2]).trim() !== "")
    .map(r => ({
      warehouse: String(r[0] ?? "").trim(),
      warehouseDesc: String(r[1] ?? "").trim(),
      partNumber: String(r[2] ?? "").trim(),
      description: String(r[3] ?? "").trim(),
      balance: cleanNum(String(r[4] ?? "")) ?? 0,
      unit: String(r[5] ?? "").trim(),
    }));
});

function parseBomMatrix(rows: string[][], type: "rm" | "ancillary"): BomSheet {
  if (rows.length < 4) return { type, products: [], byComponent: new Map() };

  // Row 0 = product codes (1-codes or 3-codes), starting at col 2
  // Row 1 = product names, starting at col 2
  // Row 2 = empty
  // Row 3+ = components: col0=code, col1=name, col2+=qty per product column
  const productCodes = rows[0].slice(2).map(v => String(v ?? ""));
  const productNames = rows[1].slice(2).map(v => String(v ?? ""));

  const products = productCodes.map((code, i) => ({
    code,
    name: productNames[i] ?? "",
    components: [] as { code: string; name: string; qty: number }[],
  }));

  const byComponent = new Map<string, { componentName: string; usedIn: { code: string; name: string; qty: number }[] }>();

  for (const row of rows.slice(3)) {
    const compCode = String(row[0] ?? "").trim();
    const compName = String(row[1] ?? "").trim();
    if (!compCode) continue;

    const entry = { componentName: compName, usedIn: [] as { code: string; name: string; qty: number }[] };

    row.slice(2).forEach((val, i) => {
      const qty = typeof val === "number" ? val : parseFloat(String(val ?? ""));
      if (!isNaN(qty) && qty > 0 && products[i]) {
        products[i].components.push({ code: compCode, name: compName, qty });
        entry.usedIn.push({ code: products[i].code, name: products[i].name, qty });
      }
    });

    if (entry.usedIn.length > 0) byComponent.set(compCode, entry);
  }

  // Filter out products with no components
  return { type, products: products.filter(p => p.components.length > 0), byComponent };
}

export const fetchRmBom = cache(async (): Promise<BomSheet> => {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BOM_SHEET_ID,
    range: "BOM matrix RM!A1:BZ800",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return parseBomMatrix((res.data.values ?? []) as string[][], "rm");
});

export const fetchAncillaryBom = cache(async (): Promise<BomSheet> => {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BOM_SHEET_ID,
    range: "BOM Ancillaries!A1:EZ800",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return parseBomMatrix((res.data.values ?? []) as string[][], "ancillary");
});

// Look up a bulk (or any part) description from the Current Inventory tab.
export async function fetchPartDescription(partNumber: string): Promise<string> {
  const inv = await fetchCurrentInventory();
  const hit = inv.find(r => r.partNumber === partNumber);
  return hit?.description ?? "";
}

const REPORTS_TAB = "Reports";

// Append one production report row to the dedicated Production Reports sheet.
// Bootstraps the header row on first write.
export async function appendProductionReport(
  headers: string[],
  row: (string | number)[],
): Promise<void> {
  const sheetId = process.env.PRODUCTION_REPORTS_SHEET_ID;
  if (!sheetId) throw new Error("PRODUCTION_REPORTS_SHEET_ID env var missing");
  const sheets = await getSheets();

  // ensure the Reports tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const hasTab = (meta.data.sheets ?? []).some(s => s.properties?.title === REPORTS_TAB);
  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: REPORTS_TAB } } }] },
    });
  }

  // ensure header row exists
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${REPORTS_TAB}!A1:A1`,
  });
  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${REPORTS_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${REPORTS_TAB}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
