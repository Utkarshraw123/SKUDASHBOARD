# Wild Nutrition — SKU Dashboard

Next.js 14 dashboard for inventory cover tracking, powered by Google Sheets.

## Local Setup

```bash
npm install
npm run dev
```

Requires `.env.local`:
```
SHEET_ID=<your-spreadsheet-id>
GOOGLE_SERVICE_ACCOUNT_JSON=<stringified-service-account-json>
```

## Vercel Deployment

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables in Vercel dashboard:
   - `SHEET_ID` → spreadsheet ID from the URL
   - `GOOGLE_SERVICE_ACCOUNT_JSON` → paste the full JSON as a single-line string

## Pages

| Route | Description |
|-------|-------------|
| `/` | Overview — KPIs + inventory chart + top critical SKUs |
| `/risk` | Cover Risk table — all SKUs below 16 weeks, color-coded |
| `/inventory` | Full inventory table + chart by type |
| `/variance` | Sales variance — outperforming vs underperforming SKUs |
| `/sku/[code]` | SKU detail drill-down |
