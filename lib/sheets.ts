import { google } from "googleapis";
import { cache } from "react";
import type { SkuRow } from "./types";

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
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
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
