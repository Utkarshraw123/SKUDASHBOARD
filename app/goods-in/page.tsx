import { fetchBulkOpenPOs, fetchGoodsInRows } from "@/lib/sheets";
import { buildGoodsInTasks, parseGoodsInRecords } from "@/lib/goods-in";
import GoodsInView from "@/components/GoodsInView";

export const revalidate = 60;

export default async function GoodsInPage() {
  const [pos, rows] = await Promise.all([
    fetchBulkOpenPOs(),
    fetchGoodsInRows(),
  ]);
  const records = parseGoodsInRecords(rows);
  const tasks = buildGoodsInTasks(pos, records);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Goods In</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Today&rsquo;s incoming deliveries from open purchase orders. Click a PO to book it in &mdash; record batch &amp; BBD, attach the CofA, and generate the QA13-CF01 form for the warehouse.
        </p>
      </div>
      <GoodsInView tasks={tasks} records={records} />
    </div>
  );
}
