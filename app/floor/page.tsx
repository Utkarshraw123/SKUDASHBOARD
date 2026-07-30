import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-cream p-6">
      <h1 className="font-serif text-2xl text-charcoal">Welcome, {user.name}</h1>
      <p className="text-text-muted mt-2">Role: {user.role}</p>
      <form action="/api/floor/logout" method="post" className="mt-6">
        <button className="rounded-xl border border-copper text-copper px-4 py-2">Sign out</button>
      </form>
    </div>
  );
}
