import { getCoverStatus } from "@/lib/types";

interface CoverBadgeProps {
  cover: number | null;
}

const statusStyle = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  low: "bg-amber-100 text-amber-700 border border-amber-200",
  ok: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  good: "bg-green-100 text-green-700 border border-green-200",
  unknown: "bg-gray-100 text-gray-500 border border-gray-200",
};

export default function CoverBadge({ cover }: CoverBadgeProps) {
  const status = getCoverStatus(cover);
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[status]}`}>
      {cover !== null ? `${cover}w` : "—"}
    </span>
  );
}
