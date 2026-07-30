import { requireUser } from "@/lib/auth/require";
import ChecklistForm from "@/components/floor/ChecklistForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChecklistPage({ params }: { params: { phase: string } }) {
  await requireUser();
  if (params.phase !== "start" && params.phase !== "end") notFound();
  return <ChecklistForm phase={params.phase} />;
}
