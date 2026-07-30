import { requireUser } from "@/lib/auth/require";
import LogoutButton from "@/components/floor/LogoutButton";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  return (
    <div className="min-h-full p-6">
      <h1 className="font-serif text-2xl text-charcoal">Welcome, {user.name}</h1>
      <p className="text-text-muted mt-2">Role: {user.role}</p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
