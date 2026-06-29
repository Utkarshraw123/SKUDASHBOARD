import { getCoverStatus } from "@/lib/types";

interface CoverBadgeProps {
  cover: number | null;
}

const statusStyle = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  low: "bg-amber-100 text-amber-700 border border-amber-200",
  ok: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  good: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  unknown: "bg-[#ede6db] text-[#8a8480] border border-[#e4ddd4]",
};

export default function CoverBadge({ cover }: CoverBadgeProps) {
  const status = getCoverStatus(cover);
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${statusStyle[status]}`}>
      {cover !== null ? `${cover}w` : "—"}
    </span>
  );
}
