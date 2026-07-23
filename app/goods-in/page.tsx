import { fetchBulkOpenPOs, fetchGoodsInRows } from "@/lib/sheets";
import { buildGoodsInPoTasks, parseGoodsInRecords } from "@/lib/goods-in";
import GoodsInView from "@/components/GoodsInView";

export const revalidate = 60;

export default async function GoodsInPage() {
  const [pos, rows] = await Promise.all([fetchBulkOpenPOs(), fetchGoodsInRows()]);
  const records = parseGoodsInRecords(rows);
  const poTasks = buildGoodsInPoTasks(pos, records);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Goods In</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Today&rsquo;s incoming deliveries, grouped by purchase order (stock items only). Open a PO to record supplier code, batch/lot &amp; BBD for each product and download the QA13-CF01 Word form. Filed forms appear below.
        </p>
      </div>
      <GoodsInView poTasks={poTasks} records={records} />
    </div>
  );
}
