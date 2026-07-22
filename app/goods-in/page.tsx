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
          Today&rsquo;s incoming deliveries from open purchase orders. Open a PO&rsquo;s <strong>G-In form</strong> &mdash; compliance records supplier code, batch/lot &amp; BBD, then downloads the QA13-CF01 Word form for the warehouse to complete by hand. Filed forms appear below.
        </p>
      </div>
      <GoodsInView tasks={tasks} records={records} />
    </div>
  );
}
