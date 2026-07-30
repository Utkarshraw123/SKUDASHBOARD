import { requireRole } from "@/lib/auth/require";
import AdminApp from "@/components/floor/AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("admin");
  return <AdminApp />;
}
